/**
 * WSS layer — WebSocket transport + connection lifecycle.
 *
 * Each socket authenticates with an `auth` command (or a `join` carrying the
 * playerId) and then issues game commands. The server is the single source of
 * truth: it applies commands to the Room and broadcasts Client-Safe snapshots
 * to every socket in the room.
 */

import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./roomManager.js";
import type { ClientCommand, ServerEvent } from "./protocol.js";
import { isClientCommand, validateClientCommand, PROTOCOL_VERSION } from "./protocol.js";
import { buildClientSnapshot } from "./snapshot.js";
import { Room } from "./room.js";
import {
  assertSeatCredentialSecret,
  DEFAULT_SEAT_CREDENTIAL_TTL_MS,
  issueSeatCredential,
  verifySeatCredential,
} from "./seat-credential.js";

export const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
export const DEFAULT_RATE_LIMIT_MAX_COMMANDS = 50;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 1000;
export const DEFAULT_MAX_ERRORS_PER_WINDOW = 10;
export const DEFAULT_MAX_CONSECUTIVE_ERRORS = 20;

export interface AuthInfo {
  playerId: string;
  playerName: string;
  roomId: string | null;
}

export interface WssOptions {
  httpServer: HttpServer;
  manager: RoomManager;
  /** Override player id allocation (tests). */
  newPlayerId?: () => string;
  onSocket?: (socket: GameSocket, info: AuthInfo) => void;
  /**
   * HMAC secret (>=32 UTF-8 bytes) for seat credentials. When set, reconnecting
   * to an already-seated playerId requires a valid unexpired credential issued
   * at first join — a player cannot take over another player's seat.
   */
  seatCredentialSecret?: string;
  /** Seat credential TTL (default 24h). */
  seatCredentialTtlMs?: number;
  /** Server-side heartbeat: ping interval (default 30s; <=0 disables). */
  heartbeatIntervalMs?: number;
  /** Max WebSocket message payload in bytes (default 64KB = 65,536). */
  maxPayloadBytes?: number;
  /** Max commands allowed per connection in rate limit window (default 50). */
  rateLimitMaxCommands?: number;
  /** Command rate limit window in ms (default 1000ms). */
  rateLimitWindowMs?: number;
  /** Max error messages sent per window before dampening responses (default 10). */
  maxErrorsPerWindow?: number;
  /** Max consecutive errors before terminating the offending connection (default 20). */
  maxConsecutiveErrors?: number;
}

export class GameSocket {
  readonly socket: WebSocket;
  playerId: string | null = null;
  playerName = "";
  roomId: string | null = null;
  authenticated = false;

  /** Rate limiter per connection: command counter and window timestamp. */
  commandCount = 0;
  rateLimitWindowStart = Date.now();

  /** Error dampening & abuse protection per connection. */
  errorCountInWindow = 0;
  errorWindowStart = Date.now();
  consecutiveErrors = 0;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  send(event: ServerEvent): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    }
  }
}

export class GameServer {
  readonly manager: RoomManager;
  private readonly wss: WebSocketServer;
  private readonly newPlayerId: () => string;
  private readonly onSocket?: (socket: GameSocket, info: AuthInfo) => void;
  private readonly sockets = new Set<GameSocket>();
  /** roomId → last observed status (for lifecycle transition events). */
  private readonly lastStatus = new Map<string, Room["status"]>();
  private readonly seatCredentialSecret: string | null;
  private readonly seatCredentialTtlMs: number;
  /** roomId → credential generation (bumped by rotation to invalidate old). */
  private readonly credentialGeneration = new Map<string, number>();
  /** socket → alive since last ping (heartbeat). */
  private readonly connectionLiveness = new WeakMap<WebSocket, boolean>();
  private heartbeatHandle: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number;

  readonly maxPayloadBytes: number;
  readonly rateLimitMaxCommands: number;
  readonly rateLimitWindowMs: number;
  readonly maxErrorsPerWindow: number;
  readonly maxConsecutiveErrors: number;

  constructor(options: WssOptions) {
    this.manager = options.manager;
    this.newPlayerId = options.newPlayerId ?? (() => this.manager.newPlayerId());
    this.onSocket = options.onSocket;
    this.seatCredentialSecret = options.seatCredentialSecret ?? null;
    if (this.seatCredentialSecret) {
      assertSeatCredentialSecret(this.seatCredentialSecret);
    }
    this.seatCredentialTtlMs = options.seatCredentialTtlMs ?? DEFAULT_SEAT_CREDENTIAL_TTL_MS;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
    this.maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
    this.rateLimitMaxCommands = options.rateLimitMaxCommands ?? DEFAULT_RATE_LIMIT_MAX_COMMANDS;
    this.rateLimitWindowMs = options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    this.maxErrorsPerWindow = options.maxErrorsPerWindow ?? DEFAULT_MAX_ERRORS_PER_WINDOW;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS;

    this.wss = new WebSocketServer({
      server: options.httpServer,
      path: "/ws",
      maxPayload: this.maxPayloadBytes,
    });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    // Server-driven room mutations (autoplay 摸切/pass timers, disconnect
    // force-autoplay) fire the Room's onChange → re-broadcast to the room's
    // clients. Without this, offline bots would never see the server's moves
    // and the table would stall.
    this.manager.setRoomChangeListener((room) => this.broadcastRoom(room));
    this.startHeartbeat();
  }

  get socketCount(): number {
    return this.sockets.size;
  }

  /** Ping every socket; terminate any that did not respond to the last ping. */
  private startHeartbeat(): void {
    if (this.heartbeatIntervalMs <= 0) return;
    this.heartbeatHandle = setInterval(() => {
      for (const gs of this.sockets) {
        const ws = gs.socket;
        if (this.connectionLiveness.get(ws) === false) {
          this.connectionLiveness.delete(ws);
          ws.terminate();
          continue;
        }
        if (ws.readyState !== WebSocket.OPEN) continue;
        this.connectionLiveness.set(ws, false);
        ws.ping();
      }
    }, this.heartbeatIntervalMs);
    this.heartbeatHandle.unref?.();
  }

  /** Issue (or refresh) a seat credential for a seated player. */
  issueCredential(roomId: string, seat: number, playerId: string): string | null {
    if (!this.seatCredentialSecret) return null;
    const generation = this.credentialGeneration.get(roomId) ?? 0;
    return issueSeatCredential(
      this.seatCredentialSecret,
      { roomId, seat, playerId },
      { generation, expiresAt: Date.now() + this.seatCredentialTtlMs },
    );
  }

  /**
   * Rotate a room's credentials — increments the generation so every
   * previously issued credential for the room becomes invalid.
   */
  rotateRoomCredentials(roomId: string): number {
    const next = (this.credentialGeneration.get(roomId) ?? 0) + 1;
    this.credentialGeneration.set(roomId, next);
    return next;
  }

  private sendSocketError(
    gs: GameSocket,
    code: string,
    message: string,
    operationId?: string,
  ): void {
    gs.consecutiveErrors++;
    const now = Date.now();
    if (now - gs.errorWindowStart >= 1000) {
      gs.errorWindowStart = now;
      gs.errorCountInWindow = 0;
    }
    gs.errorCountInWindow++;

    // Circuit breaker: excessive consecutive errors terminates connection to prevent attack/loop
    if (gs.consecutiveErrors > this.maxConsecutiveErrors) {
      if (gs.errorCountInWindow <= this.maxErrorsPerWindow) {
        gs.send({
          type: "error",
          code: "too_many_errors",
          message: "Excessive errors; connection closed",
          operationId,
        });
      }
      try {
        gs.socket.close(4429, "Too many errors");
      } catch {
        gs.socket.terminate();
      }
      return;
    }

    // Dampen excessive error replies: do not flood client with endless error frames
    if (gs.errorCountInWindow > this.maxErrorsPerWindow) {
      return;
    }

    gs.send({ type: "error", code, message, operationId });
  }

  private handleConnection(ws: WebSocket): void {
    const gs = new GameSocket(ws);
    this.sockets.add(gs);
    ws.on("pong", () => this.connectionLiveness.set(ws, true));
    ws.on("message", (data) => {
      // 1. Rate limiting per connection
      const now = Date.now();
      if (now - gs.rateLimitWindowStart >= this.rateLimitWindowMs) {
        gs.rateLimitWindowStart = now;
        gs.commandCount = 0;
      }
      gs.commandCount++;
      if (gs.commandCount > this.rateLimitMaxCommands) {
        this.sendSocketError(gs, "rate_limited", "Too many commands, please slow down");
        return;
      }

      // 2. Message size limit check
      const byteLength = Buffer.isBuffer(data)
        ? data.length
        : typeof data === "string"
          ? Buffer.byteLength(data)
          : (data as ArrayBuffer).byteLength ?? 0;

      if (byteLength > this.maxPayloadBytes) {
        this.sendSocketError(
          gs,
          "payload_too_large",
          `Message size exceeds limit of ${this.maxPayloadBytes} bytes`,
        );
        return;
      }

      // 3. Decode & Parse JSON
      let text: string;
      try {
        text = data.toString();
      } catch {
        this.sendSocketError(gs, "bad_payload", "Failed to decode payload");
        return;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        this.sendSocketError(gs, "bad_json", "Invalid JSON");
        return;
      }

      // 4. Schema & Field Validation
      const result = validateClientCommand(raw);
      if (!result.ok) {
        const opId =
          typeof raw === "object" &&
          raw !== null &&
          "operationId" in raw &&
          typeof (raw as Record<string, unknown>).operationId === "string"
            ? ((raw as Record<string, unknown>).operationId as string)
            : undefined;
        this.sendSocketError(gs, result.code, result.message, opId);
        return;
      }

      this.handleCommand(gs, result.command);
    });
    ws.on("close", () => {
      this.sockets.delete(gs);
      if (gs.playerId && gs.roomId) {
        const room = this.manager.playerRoom(gs.playerId);
        if (room) {
          this.manager.disconnect(gs.playerId);
          this.broadcastRoom(room);
        }
      }
    });
    ws.on("error", () => {
      /* transport error — close handler cleans up */
    });
  }

  private handleCommand(gs: GameSocket, command: ClientCommand): void {
    try {
      switch (command.type) {
        case "create":
          this.handleCreate(gs, command);
          break;
        case "join":
          this.handleJoin(gs, command);
          break;
        case "ping": {
          // Heartbeat: echo the client timestamp. No room/seat required.
          gs.consecutiveErrors = 0;
          const t = (command as Extract<ClientCommand, { type: "ping" }>).t;
          gs.send({ type: "pong", t: t ?? 0 });
          break;
        }
        case "ready":
        case "discard":
        case "reaction":
        case "pass": {
          if (!gs.authenticated || !gs.roomId || !gs.playerId) {
            this.sendSocketError(gs, "not_authenticated", "Join a room first", command.operationId);
            return;
          }
          const room = this.manager.get(gs.roomId);
          if (!room) {
            this.sendSocketError(gs, "room_gone", "Room no longer exists", command.operationId);
            return;
          }
          const result = room.handleCommand(gs.playerId, command);
          if (!result.ok) {
            this.sendSocketError(
              gs,
              result.error!.code,
              result.error!.message,
              command.operationId,
            );
          } else {
            gs.consecutiveErrors = 0;
          }
          this.broadcastRoom(room);
          break;
        }
      }
    } catch (e) {
      this.sendSocketError(
        gs,
        "internal",
        e instanceof Error ? e.message : "Internal error",
        command.operationId,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Auth / create / join
  // -------------------------------------------------------------------------

  private handleCreate(gs: GameSocket, command: Extract<ClientCommand, { type: "create" }>): void {
    gs.consecutiveErrors = 0;
    const playerId = gs.playerId ?? this.newPlayerId();
    gs.playerId = playerId;
    gs.playerName = command.playerName ?? "Player";
    const { roomId, room } = this.manager.createRoom();
    room.join(playerId, gs.playerName);
    this.manager.playerRooms.set(playerId, roomId);
    gs.roomId = roomId;
    gs.authenticated = true;
    gs.send({ type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomId });
    gs.send({ type: "room.created", roomId, generationId: room.generationId });
    this.onSocket?.(gs, { playerId, playerName: gs.playerName, roomId });
    this.broadcastRoom(room);
  }

  private handleJoin(gs: GameSocket, command: Extract<ClientCommand, { type: "join" }>): void {
    const roomId = command.roomId;
    const room = this.manager.get(roomId);
    if (!room) {
      this.sendSocketError(gs, "room_not_found", `Room ${roomId} not found`, command.operationId);
      return;
    }
    let playerId: string | null = command.playerId ?? gs.playerId;
    let isReconnect = false;
    if (playerId !== null && room.seatOf(playerId) !== -1) {
      // Same identity already seated — restore it (reconnect), even mid-game.
      isReconnect = true;
    } else if (playerId === null) {
      playerId = this.newPlayerId();
    }
    // Seat credential gate: reconnecting to an already-seated playerId requires
    // the exact credential issued at first join (binding room/seat/player).
    if (isReconnect && this.seatCredentialSecret && playerId !== null) {
      const seat = room.seatOf(playerId);
      const generation = this.credentialGeneration.get(roomId) ?? 0;
      const ok = verifySeatCredential(
        this.seatCredentialSecret,
        { roomId, seat, playerId },
        generation,
        command.seatCredential,
        Date.now(),
      );
      if (!ok) {
        this.sendSocketError(
          gs,
          "invalid_credential",
          "Reconnect requires a valid seat credential for this seat",
          command.operationId,
        );
        return;
      }
    }
    gs.consecutiveErrors = 0;
    gs.playerId = playerId;
    gs.playerName = command.playerName ?? gs.playerName ?? "Player";
    const seat = room.join(playerId, gs.playerName);
    if (isReconnect) {
      this.manager.reconnect(playerId);
    }
    this.manager.playerRooms.set(playerId, roomId);
    gs.roomId = roomId;
    gs.authenticated = true;
    // Issue a fresh credential (new join) or refresh it (reconnect).
    const seatCredential =
      playerId === null ? undefined : this.issueCredential(roomId, seat, playerId) ?? undefined;
    gs.send({ type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomId, seatCredential });
    gs.send({
      type: "player.joined",
      roomId,
      seat,
      playerId,
      playerName: gs.playerName,
      connected: true,
      generationId: room.generationId,
      seatCredential,
    });
    this.onSocket?.(gs, { playerId, playerName: gs.playerName, roomId });
    this.broadcastRoom(room);
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------

  /** Send the current snapshot (and lifecycle transitions) to every socket. */
  broadcastRoom(room: Room): void {
    const prev = this.lastStatus.get(room.id);
    if (prev !== room.status) {
      this.lastStatus.set(room.id, room.status);
      for (const gs of this.sockets) {
        if (gs.roomId !== room.id || !gs.authenticated || gs.playerId === null) continue;
        if (room.status === "playing") {
          gs.send({
            type: "game.started",
            roomId: room.id,
            generationId: room.generationId,
            dealer: room.state?.dealer ?? 0,
            dealerStreak: room.dealerStreak,
          });
        } else if (room.status === "ended") {
          gs.send({
            type: "game.ended",
            roomId: room.id,
            generationId: room.generationId,
            winner: room.winner,
            selfDraw: room.selfDraw,
            kongDraw: room.kongDraw,
            dealer: room.state?.dealer ?? 0,
            dealerStreak: room.dealerStreak,
            breakdown: room.breakdown,
            ledger: room.ledger ?? [],
            scores: room.scores,
          });
        }
      }
    }
    for (const gs of this.sockets) {
      if (gs.roomId !== room.id || !gs.authenticated || gs.playerId === null) continue;
      const seat = room.seatOf(gs.playerId);
      if (seat === -1) continue;
      gs.send({
        type: "snapshot",
        roomId: room.id,
        generationId: room.generationId,
        snapshot: buildClientSnapshot(room, seat),
      });
    }
  }

  /** Force-close all sockets (shutdown / tests). */
  close(): Promise<void> {
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
    for (const gs of this.sockets) {
      try {
        gs.socket.close();
      } catch {
        /* ignore */
      }
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
