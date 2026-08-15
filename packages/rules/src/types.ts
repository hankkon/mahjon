/**
 * Shared Domain types: Melds, Reactions, Game state, and scoring contracts.
 *
 * Authoritative Domain — `packages/rules`.
 */

import type { Tile, TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";

// ---------------------------------------------------------------------------
// Melds
// ---------------------------------------------------------------------------

export interface MeldBase {
  /** Unique meld id within the game. */
  id: number;
  /** Every tile physically in the meld (3 for chi/peng, 4 for kong). */
  tiles: readonly TileInstance[];
}

/** 吃 (chi) — two hand tiles + the claimed discard, forming a run. */
export interface ChiMeld extends MeldBase {
  kind: "chi";
  claimed: TileInstance;
  handTiles: readonly [TileInstance, TileInstance];
}

/** 碰 (peng) — two hand tiles + the claimed discard, forming a triplet. */
export interface PengMeld extends MeldBase {
  kind: "peng";
  claimed: TileInstance;
}

export type KongType = "open" | "closed" | "add-on";

/** 槓 (kong) — open (明槓), closed (暗槓), or add-on (加槓). */
export interface KongMeld extends MeldBase {
  kind: "kong";
  kongType: KongType;
  /** Present for open kong (the claimed discard). */
  claimed?: TileInstance;
  /** Present for add-on kong (the peng meld being upgraded). */
  fromPengId?: number;
}

export type Meld = ChiMeld | PengMeld | KongMeld;

// ---------------------------------------------------------------------------
// Reactions (client proposals the server must resolve)
// ---------------------------------------------------------------------------

export type ReactionKind = "win" | "kong" | "peng" | "chi";

export interface ChiReaction {
  kind: "chi";
  seat: number;
  /** The two hand-tile instance ids to combine with the discard. */
  handTileIds: readonly [number, number];
}

export interface KongReaction {
  kind: "kong";
  seat: number;
  kongType: KongType;
  /** Hand-tile instance ids: 3 for open kong, 4 for closed kong. */
  handTileIds?: readonly number[];
  /** Peng meld id to upgrade (add-on kong). */
  pengMeldId?: number;
}

export interface PengReaction {
  kind: "peng";
  seat: number;
}

export interface WinReaction {
  kind: "win";
  seat: number;
  selfDraw: boolean;
}

export type Reaction = ChiReaction | KongReaction | PengReaction | WinReaction;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export type GamePhase = "draw" | "discard" | "reaction" | "ended";

export interface GameState {
  /** The authoritative wall (tiles, cursors, hands, flowers). */
  wall: import("./wall.js").WallState;
  /** Each player's open melds (chi / peng / kong). */
  melds: [Meld[], Meld[], Meld[], Meld[]];
  dealer: number;
  turn: number;
  phase: GamePhase;
  /** Discard pool (牌池). */
  discards: TileInstance[];
  /** Per-seat discard history (各家的棄牌河) — parallel to the pool, in
   * discard order per seat, so clients can render a four-sided river. */
  discardsBySeat: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  lastDiscard?: TileInstance;
  lastDiscardBy?: number;
  /** The seat of the most recent draw (normal turn draw or kong replacement). */
  lastDrawnBy?: number;
  /** The most recent tile physically added to a hand — the 摸切 (tsumogiri)
   * target when the server auto-discards on a discard-phase timeout. */
  lastDrawnTile?: TileInstance;
  winner?: number;
  /** Consecutive dealer holds (連莊). >=1 when the dealer keeps the seat.
   * Used for 連莊台 in scoring. */
  dealerStreak: number;
}

// ---------------------------------------------------------------------------
// Small tile predicates
// ---------------------------------------------------------------------------

/** True when two tile instances have the same identity (same species). */
export function sameTileIdentity(a: TileInstance, b: TileInstance): boolean {
  return tileToId(a.tile) === tileToId(b.tile);
}

/** True when the instance's identity equals the given tile. */
export function instanceMatchesTile(inst: TileInstance, tile: Tile): boolean {
  return tileToId(inst.tile) === tileToId(tile);
}
