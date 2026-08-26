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

export type CommandType =
  | "create"
  | "join"
  | "ready"
  | "discard"
  | "reaction"
  | "pass"
  | "set_client_seed"
  | "ping";

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
  /**
   * Seat credential issued at first join. REQUIRED when reconnecting with an
   * already-seated playerId and the server has SEAT_CREDENTIAL_SECRET set.
   */
  seatCredential?: string;
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

export interface SetClientSeedCommand extends CommandBase {
  type: "set_client_seed";
  clientSeed: string;
}

export type ClientCommand =
  | CreateCommand
  | JoinCommand
  | ReadyCommand
  | PassCommand
  | DiscardCommand
  | ReactionCommand
  | SetClientSeedCommand
  | PingCommand;

// ---------------------------------------------------------------------------
// Events (Server → Client)
// ---------------------------------------------------------------------------

export type ServerEvent =
  | { type: "welcome"; protocol: string; playerId: string; roomId: string | null; seatCredential?: string }
  | { type: "room.created"; roomId: string; generationId: number }
  | {
      type: "player.joined";
      roomId: string;
      seat: number;
      playerId: string;
      playerName: string;
      connected: boolean;
      generationId: number;
      seatCredential?: string;
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

/**
 * Detailed validation result for inbound client commands.
 */
export type CommandValidationResult =
  | { ok: true; command: ClientCommand }
  | { ok: false; code: string; message: string };

export function validateClientCommand(raw: unknown): CommandValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "bad_command", message: "Command must be a JSON object" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== "string") {
    return { ok: false, code: "bad_command", message: "Missing or invalid command type" };
  }
  if (typeof o.operationId !== "string" || o.operationId.length === 0 || o.operationId.length > 128) {
    return { ok: false, code: "bad_command", message: "Invalid or oversized operationId (must be 1-128 chars)" };
  }
  if (o.generationId !== undefined) {
    if (typeof o.generationId !== "number" || !Number.isInteger(o.generationId)) {
      return { ok: false, code: "bad_command", message: "Invalid generationId (must be integer)" };
    }
  }

  switch (o.type) {
    case "create": {
      if (o.playerName !== undefined && (typeof o.playerName !== "string" || o.playerName.length > 64)) {
        return { ok: false, code: "bad_command", message: "Invalid playerName (must be string <= 64 chars)" };
      }
      return { ok: true, command: o as unknown as CreateCommand };
    }
    case "join": {
      if (typeof o.roomId !== "string" || o.roomId.length === 0 || o.roomId.length > 64) {
        return { ok: false, code: "bad_command", message: "Invalid roomId (must be 1-64 chars)" };
      }
      if (o.playerId !== undefined && (typeof o.playerId !== "string" || o.playerId.length === 0 || o.playerId.length > 64)) {
        return { ok: false, code: "bad_command", message: "Invalid playerId (must be 1-64 chars)" };
      }
      if (o.playerName !== undefined && (typeof o.playerName !== "string" || o.playerName.length > 64)) {
        return { ok: false, code: "bad_command", message: "Invalid playerName (must be string <= 64 chars)" };
      }
      if (o.seatCredential !== undefined && (typeof o.seatCredential !== "string" || o.seatCredential.length > 512)) {
        return { ok: false, code: "bad_command", message: "Invalid seatCredential (must be string <= 512 chars)" };
      }
      return { ok: true, command: o as unknown as JoinCommand };
    }
    case "ready": {
      return { ok: true, command: o as unknown as ReadyCommand };
    }
    case "ping": {
      if (o.t !== undefined && (typeof o.t !== "number" || !Number.isFinite(o.t))) {
        return { ok: false, code: "bad_command", message: "Invalid timestamp t (must be finite number)" };
      }
      return { ok: true, command: o as unknown as PingCommand };
    }
    case "pass": {
      return { ok: true, command: o as unknown as PassCommand };
    }
    case "discard": {
      if (typeof o.tileInstanceId !== "number" || !Number.isInteger(o.tileInstanceId) || o.tileInstanceId < 0) {
        return { ok: false, code: "bad_command", message: "Invalid tileInstanceId (must be non-negative integer)" };
      }
      return { ok: true, command: o as unknown as DiscardCommand };
    }
    case "reaction": {
      if (o.kind !== "chi" && o.kind !== "peng" && o.kind !== "kong") {
        return { ok: false, code: "bad_command", message: "Invalid reaction kind (must be chi, peng, or kong)" };
      }
      if (o.kongType !== undefined && o.kongType !== "open" && o.kongType !== "closed" && o.kongType !== "add-on") {
        return { ok: false, code: "bad_command", message: "Invalid kongType (must be open, closed, or add-on)" };
      }
      if (o.handTileIds !== undefined) {
        if (!Array.isArray(o.handTileIds) || o.handTileIds.length > 4) {
          return { ok: false, code: "bad_command", message: "Invalid handTileIds (must be array of <= 4 tile IDs)" };
        }
        for (const id of o.handTileIds) {
          if (typeof id !== "number" || !Number.isInteger(id) || id < 0) {
            return { ok: false, code: "bad_command", message: "Invalid tile ID in handTileIds" };
          }
        }
      }
      if (o.pengMeldId !== undefined && (typeof o.pengMeldId !== "number" || !Number.isInteger(o.pengMeldId) || o.pengMeldId < 0)) {
        return { ok: false, code: "bad_command", message: "Invalid pengMeldId (must be non-negative integer)" };
      }
      return { ok: true, command: o as unknown as ReactionCommand };
    }
    case "set_client_seed": {
      if (typeof o.clientSeed !== "string" || o.clientSeed.trim().length === 0 || o.clientSeed.length > 64) {
        return { ok: false, code: "bad_command", message: "Invalid clientSeed (must be non-empty string <= 64 chars)" };
      }
      return { ok: true, command: o as unknown as SetClientSeedCommand };
    }
    default:
      return { ok: false, code: "bad_command", message: `Unknown command type: ${String(o.type)}` };
  }
}

/** Structural guard for inbound frames. */
export function isClientCommand(raw: unknown): raw is ClientCommand {
  return validateClientCommand(raw).ok;
}
