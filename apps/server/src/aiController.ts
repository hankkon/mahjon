/**
 * aiController — fills empty seats with 3 AIs and drives their moves.
 *
 * On a tick (200ms) it scans every live room:
 *   - A room with exactly 1 connected human and < 4 players → auto-join the
 *     3 AIs (初級 / 中級 / 高級) into the free seats.
 *   - Each AI seat then acts when it is its turn: ready in lobby, discard on
 *     its discard phase, react in a reaction window (or self-kong on its own
 *     discard phase). Everything flows through room.handleCommand() — the same
 *     authoritative path a socket uses — with unique operationIds.
 *
 * AI seats are `connected: true` but have NO socket: they never receive
 * ws.on("close"), so they are never auto-disconnected, and RoomManager.cleanup()
 * keeps rooms alive while any player is connected. Commands are broadcast to
 * the human clients via GameServer.broadcastRoom(room) right after each move.
 *
 * The tick also unblocks mid-game seats when a room already has all 4 players
 * (e.g. a human joins a room that was mid-game with 3 AI seats).
 */

import type { RoomManager } from "./roomManager.js";
import type { GameServer } from "./wss.js";
import { AI_ACTION_DELAY_MS, AI_REACTION_DELAY_MS, decideDiscard, decideReaction, DIFFICULTY_NAMES, isAiPlayerId, shouldReady, type AiDifficulty } from "./aiPlayer.js";
import type { Room } from "./room.js";

export interface AiControllerOptions {
  /** Scan interval in ms (default 200). */
  tickMs?: number;
  /** How many AI seats to auto-fill (default 3). */
  aiCount?: number;
}

const AI_DIFFICULTIES: readonly AiDifficulty[] = ["easy", "medium", "hard"];

export class AiController {
  private readonly manager: RoomManager;
  private readonly games: GameServer;
  private readonly tickMs: number;
  private readonly aiCount: number;
  private readonly aiPlayerIds: string[];
  private readonly lastSeen = new Map<string, { count: number }>();
  private readonly opCounter = new Map<string, number>();
  /** playerId → per-AI move throttling (so moves don't look instant). */
  private readonly nextActAt = new Map<string, number>();
  /** roomId:playerId → last reaction window generationId seen. */
  private readonly lastReactionGen = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private readonly difficultyForPlayer = new Map<string, AiDifficulty>();

  constructor(manager: RoomManager, games: GameServer, options: AiControllerOptions = {}) {
    this.manager = manager;
    this.games = games;
    this.tickMs = options.tickMs ?? 200;
    this.aiCount = options.aiCount ?? 3;
    // ai-0 / ai-1 / ai-2 — fixed identities per server so an AI can persist
    // across a human reconnect (reconnect restores the seat by playerId).
    this.aiPlayerIds = Array.from({ length: this.aiCount }, (_, i) => `ai-${i}`);
    for (let i = 0; i < this.aiCount; i++) {
      this.difficultyForPlayer.set(this.aiPlayerIds[i]!, AI_DIFFICULTIES[i]!);
    }
  }

  /** Start the background tick (idempotent). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
    // Prime immediately so a freshly created room gets AIs fast.
    this.tick();
  }

  /** Stop the background tick (shutdown). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private opId(roomId: string, playerId: string, kind: string): string {
    const key = `${roomId}:${playerId}`;
    const n = (this.opCounter.get(key) ?? 0) + 1;
    this.opCounter.set(key, n);
    return `ai-${playerId}-${kind}-${n}`;
  }

  // -------------------------------------------------------------------------
  // Main tick
  // -------------------------------------------------------------------------

  /** Execute a single scan tick (public for testing and deterministic ticks). */
  tick(): void {
    for (const room of this.manager.rooms.values()) {
      this.ensureAis(room);
      this.act(room);
    }
  }

  // -------------------------------------------------------------------------
  // Auto-fill
  // -------------------------------------------------------------------------

  /**
   * Auto-join the AI seats when a room has exactly 1 connected human and
   * fewer than 4 players. Rooms with 0 humans are left alone (they belong to
   * stress/qa runs — never poison them).
   */
  private ensureAis(room: Room): void {
    const players = room.players;
    const connectedHumans = players.filter((p) => p && p.connected && !isAiPlayerId(p.playerId)).length;
    if (connectedHumans !== 1) return;

    const freeSeats = players.reduce<number[]>((acc, p, i) => {
      if (p === null) acc.push(i);
      return acc;
    }, []);

    for (const aiId of this.aiPlayerIds) {
      // Already seated in this room?
      const seated = room.seatOf(aiId);
      if (seated !== -1) continue;
      const seat = freeSeats.shift();
      if (seat === undefined) break; // room full (or all free seats taken)
      const difficulty = this.difficultyForPlayer.get(aiId) ?? "medium";
      const name = DIFFICULTY_NAMES[difficulty];
      // Track the room in the manager so playerRoom() resolves (also keeps the
      // player-rooms map consistent for cleanup).
      this.manager.join(room.id, aiId, name);
    }
  }

  // -------------------------------------------------------------------------
  // AI action loop (per AI seat)
  // -------------------------------------------------------------------------

  private act(room: Room): void {
    const players = room.players;
    if (!players.some((p) => p && p.connected && !isAiPlayerId(p.playerId))) return; // no human watching

    for (let seat = 0; seat < 4; seat++) {
      const p = players[seat];
      if (!p || !isAiPlayerId(p.playerId) || !p.connected) continue;
      const difficulty = this.difficultyForPlayer.get(p.playerId) ?? "medium";

      // --- Ready (lobby / next round after ended). ---
      if (room.status === "lobby" || room.status === "ended") {
        if (!p.ready && shouldReady(room, seat)) {
          this.sendCommand(room, p.playerId, {
            type: "ready",
            operationId: this.opId(room.id, p.playerId, "ready"),
          });
        }
        continue;
      }

      // --- Playing: discard or reaction. ---
      const state = room.state;
      if (!state) continue;

      if (state.phase === "discard" && state.turn === seat) {
        const decision = decideDiscard(room, seat, difficulty);
        if (!decision) continue;
        if (!this.throttle(p.playerId, difficulty)) continue;
        this.sendCommand(room, p.playerId, {
          type: "discard",
          operationId: this.opId(room.id, p.playerId, "discard"),
          tileInstanceId: decision.tileInstanceId,
        });
        continue;
      }

      if (state.phase === "reaction") {
        // Only seats with a pending reaction kind act (else pass / skip).
        const decision = decideReaction(room, seat, difficulty);
        if (!decision) continue;
        // Reaction uses a longer deliberate delay so a solo human can read the
        // 吃/碰/槓/過 hint before the AI claims/passes it away.
        if (!this.reactionThrottle(room.id, p.playerId, room.generationId)) continue;
        if (decision.action === "pass") {
          this.sendCommand(room, p.playerId, {
            type: "pass",
            operationId: this.opId(room.id, p.playerId, "pass"),
          });
        } else {
          this.sendCommand(room, p.playerId, {
            type: "reaction",
            operationId: this.opId(room.id, p.playerId, "reaction"),
            kind: decision.kind,
            kongType: decision.kongType,
            handTileIds: decision.handTileIds,
            pengMeldId: decision.pengMeldId,
          });
        }
        continue;
      }
    }
  }

  /** Human-feel delay per difficulty before the next move of an AI. */
  private throttle(playerId: string, difficulty: AiDifficulty): boolean {
    const now = Date.now();
    const at = this.nextActAt.get(playerId) ?? 0;
    if (now < at) return false;
    const [min, max] = AI_ACTION_DELAY_MS[difficulty];
    this.nextActAt.set(playerId, now + min + Math.random() * (max - min));
    return true;
  }

  /** Longer reaction-window throttle so a solo human isn't instantly raced. */
  private reactionThrottle(roomId: string, playerId: string, generationId: number): boolean {
    const key = `${roomId}:${playerId}`;
    const now = Date.now();
    if (this.lastReactionGen.get(key) !== generationId) {
      // First time seeing this reaction window generation for this AI seat!
      this.lastReactionGen.set(key, generationId);
      const [min, max] = AI_REACTION_DELAY_MS;
      this.nextActAt.set(playerId, now + min + Math.random() * (max - min));
      return false;
    }
    const at = this.nextActAt.get(playerId) ?? 0;
    if (now < at) return false;
    return true;
  }

  private sendCommand(room: Room, playerId: string, command: Parameters<Room["handleCommand"]>[1]): void {
    const result = room.handleCommand(playerId, command);
    // Always re-broadcast — a command may have been accepted (state changed)
    // or rejected benignly (stale/duplicate); humans need the latest state.
    this.games.broadcastRoom(room);
    if (!result.ok) {
      const code = result.error?.code ?? "unknown";
      // Benign races (stale_generation / wrong_phase / not_your_turn) happen
      // naturally with a tick loop — they are safe to ignore silently.
      if (["stale_generation", "wrong_phase", "not_your_turn", "no_tile", "not_lobby", "not_playing", "no_discard", "illegal_kong", "illegal_peng", "illegal_chi", "bad_chi", "self_reaction", "disconnected"].includes(code)) {
        return;
      }
      console.warn(`[ai] ${playerId} command rejected (${code}): ${result.error?.message ?? ""}`);
    }
  }
}
