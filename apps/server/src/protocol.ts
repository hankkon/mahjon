/**
 * Wire protocol — Client→Server commands and Server→Client events.
 *
 * All payloads are JSON. Every command carries an `operationId` (idempotency
 * key — the same operationId is never executed twice) and may carry the
 * `generationId` of the snapshot the client last saw. Commands with a stale
 * generationId are dropped by the room (防重機制).
 *
 * Authoritative server layer — `apps/server`.
 */

import type { FanBreakdown, LedgerEntry } from "@taiwan-mahjong/rules";
import type { ClientSnapshot } from "./snapshot.js";

export const PROTOCOL_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Commands (Client → Server)
// ---------------------------------------------------------------------------

export type CommandType = "create" | "join" | "ready" | "discard" | "reaction" | "pass" | "ping";

export interface CommandBase {
  type: CommandType;
  /** Client-generated unique id — idempotency key. Required. */
  operationId: string;
  /** GenerationId of the snapshot the client is acting on. Optional; when
   * present and stale the command is rejected (stale commands are dropped). */
  generationId?: number;
}

export interface CreateCommand extends CommandBase {
  type: "create";
  playerName?: string;
}

export interface JoinCommand extends CommandBase {
  type: "join";
  roomId: string;
  /** Prior playerId when reconnecting (seat is restored). */
  playerId?: string;
  playerName?: string;
}

export interface ReadyCommand extends CommandBase {
  type: "ready";
}

/** Heartbeat — the client proves liveness; server answers with a `pong` event. */
export interface PingCommand extends CommandBase {
  type: "ping";
  /** Client timestamp (ms) echoed back in the pong. */
  t?: number;
}

export interface PassCommand extends CommandBase {
  type: "pass";
}

export interface DiscardCommand extends CommandBase {
  type: "discard";
  tileInstanceId: number;
}

export interface ReactionCommand extends CommandBase {
  type: "reaction";
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  /** Hand-tile instance ids: 2 for chi, 3 for open kong, 4 for closed kong. */
  handTileIds?: number[];
  /** Peng meld id to upgrade (add-on kong). */
  pengMeldId?: number;
}

export type ClientCommand =
  | CreateCommand
  | JoinCommand
  | ReadyCommand
  | PassCommand
  | DiscardCommand
  | ReactionCommand
  | PingCommand;

// ---------------------------------------------------------------------------
// Events (Server → Client)
// ---------------------------------------------------------------------------

export type ServerEvent =
  | { type: "welcome"; protocol: string; playerId: string; roomId: string | null }
  | { type: "room.created"; roomId: string; generationId: number }
  | {
      type: "player.joined";
      roomId: string;
      seat: number;
      playerId: string;
      playerName: string;
      connected: boolean;
      generationId: number;
    }
  | { type: "player.ready"; roomId: string; seat: number; generationId: number }
  | { type: "player.left"; roomId: string; seat: number; generationId: number }
  | {
      type: "game.started";
      roomId: string;
      generationId: number;
      dealer: number;
      /** 連莊 count carried into this hand (連莊台 / rotation verify). */
      dealerStreak: number;
    }
  | {
      type: "game.ended";
      roomId: string;
      generationId: number;
      winner: number | null;
      selfDraw: boolean;
      kongDraw: boolean;
      /** Dealer seat for the hand that just ended (for 過莊/連莊 tracking). */
      dealer: number;
      /** 連莊 count carried into the ended hand (連莊台 / rotation verify). */
      dealerStreak: number;
      breakdown: FanBreakdown | null;
      ledger: LedgerEntry[];
      scores: number[];
    }
  | { type: "error"; code: string; message: string; operationId?: string }
  | { type: "snapshot"; roomId: string; generationId: number; snapshot: ClientSnapshot }
  | { type: "pong"; t: number };

/** Structural guard for inbound frames. */
export function isClientCommand(raw: unknown): raw is ClientCommand {
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return typeof o.type === "string" && typeof o.operationId === "string";
}
