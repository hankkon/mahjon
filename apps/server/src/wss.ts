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
import { isClientCommand, PROTOCOL_VERSION } from "./protocol.js";
import { buildClientSnapshot } from "./snapshot.js";
import { Room } from "./room.js";

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
}

export class GameSocket {
  readonly socket: WebSocket;
  playerId: string | null = null;
  playerName = "";
  roomId: string | null = null;
  authenticated = false;

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

  constructor(options: WssOptions) {
    this.manager = options.manager;
    this.newPlayerId = options.newPlayerId ?? (() => this.manager.newPlayerId());
    this.onSocket = options.onSocket;
    this.wss = new WebSocketServer({ server: options.httpServer, path: "/ws" });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    // Server-driven room mutations (autoplay 摸切/pass timers, disconnect
    // force-autoplay) fire the Room's onChange → re-broadcast to the room's
    // clients. Without this, offline bots would never see the server's moves
    // and the table would stall.
    this.manager.setRoomChangeListener((room) => this.broadcastRoom(room));
  }

  get socketCount(): number {
    return this.sockets.size;
  }

  private handleConnection(ws: WebSocket): void {
    const gs = new GameSocket(ws);
    this.sockets.add(gs);
    ws.on("message", (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        gs.send({ type: "error", code: "bad_json", message: "Invalid JSON" });
        return;
      }
      if (!isClientCommand(raw)) {
        gs.send({ type: "error", code: "bad_command", message: "Malformed command" });
        return;
      }
      this.handleCommand(gs, raw);
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
          const t = (command as Extract<ClientCommand, { type: "ping" }>).t;
          gs.send({ type: "pong", t: t ?? 0 });
          break;
        }
        case "ready":
        case "discard":
        case "reaction":
        case "pass": {
          if (!gs.authenticated || !gs.roomId || !gs.playerId) {
            gs.send({ type: "error", code: "not_authenticated", message: "Join a room first" });
            return;
          }
          const room = this.manager.get(gs.roomId);
          if (!room) {
            gs.send({ type: "error", code: "room_gone", message: "Room no longer exists" });
            return;
          }
          const result = room.handleCommand(gs.playerId, command);
          if (!result.ok) {
            gs.send({
              type: "error",
              code: result.error!.code,
              message: result.error!.message,
              operationId: command.operationId,
            });
          }
          this.broadcastRoom(room);
          break;
        }
      }
    } catch (e) {
      gs.send({
        type: "error",
        code: "internal",
        message: e instanceof Error ? e.message : "Internal error",
        operationId: command.operationId,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Auth / create / join
  // -------------------------------------------------------------------------

  private handleCreate(gs: GameSocket, command: Extract<ClientCommand, { type: "create" }>): void {
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
      gs.send({ type: "error", code: "room_not_found", message: `Room ${roomId} not found` });
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
    gs.playerId = playerId;
    gs.playerName = command.playerName ?? gs.playerName ?? "Player";
    const seat = room.join(playerId, gs.playerName);
    if (isReconnect) {
      this.manager.reconnect(playerId);
    }
    this.manager.playerRooms.set(playerId, roomId);
    gs.roomId = roomId;
    gs.authenticated = true;
    gs.send({ type: "welcome", protocol: PROTOCOL_VERSION, playerId, roomId });
    gs.send({
      type: "player.joined",
      roomId,
      seat,
      playerId,
      playerName: gs.playerName,
      connected: true,
      generationId: room.generationId,
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
