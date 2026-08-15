/**
 * Peng (碰牌) — server-authoritative Domain logic.
 *
 * 碰: any player (other than the discarder) may claim the latest discard with
 * exactly two identical hand tiles, forming a triplet (刻子). The claimant
 * does NOT draw a new tile and moves straight to the discard phase
 * (不摸牌轉入出牌階段), mirroring chi.
 */

import type { GameState, Meld, PengMeld } from "./types.js";
import { sameTileIdentity } from "./types.js";
import type { TileInstance } from "./tiles.js";
import { nextMeldId, removeByInstanceId, removeFromRiver } from "./game.js";

export interface PengOption {
  /** The two hand-tile instance ids to combine with the discard. */
  handTileIds: readonly [number, number];
}

/**
 * Detect whether the player can peng the latest discard.
 * Returns null when there is no discard, or when the seat is the discarder
 * itself (a player cannot peng their own discard).
 */
export function pengOptions(state: GameState, seat: number): PengOption | null {
  const discard = state.lastDiscard;
  if (!discard) return null;
  if (state.lastDiscardBy === undefined || state.lastDiscardBy === seat) return null;
  const hand = state.wall.hands[seat] as TileInstance[];
  const matches = hand.filter((t) => sameTileIdentity(t, discard));
  if (matches.length < 2) return null;
  return {
    handTileIds: [matches[0]!.instanceId, matches[1]!.instanceId],
  };
}

export interface PengResult {
  meldId: number;
  /** The discard instance consumed by this meld. */
  claimed: TileInstance;
}

/**
 * Perform a peng meld. Validates the two hand tiles, moves the claimed discard
 * out of the pool into the meld, appends the meld, and moves the player
 * straight to the discard phase (no draw).
 */
export function performPeng(
  state: GameState,
  seat: number,
  option: PengOption,
): PengResult {
  const discard = state.lastDiscard;
  if (!discard) {
    throw new Error("No discard available to peng");
  }
  const hand = state.wall.hands[seat] as TileInstance[];
  const [id1, id2] = option.handTileIds;
  const t1 = hand.find((t) => t.instanceId === id1);
  const t2 = hand.find((t) => t.instanceId === id2);
  if (!t1 || !t2) {
    throw new Error("Peng hand tiles must be in the claimant's hand");
  }

  // Remove the claimed discard from the pool (and its owner's river).
  const discardIdx = state.discards.indexOf(discard);
  if (discardIdx === -1) {
    throw new Error("Claimed discard not in the discard pool");
  }
  state.discards.splice(discardIdx, 1);
  removeFromRiver(state, discard);
  removeByInstanceId(hand, id1);
  removeByInstanceId(hand, id2);

  const meldId = nextMeldId(state);
  (state.melds[seat] as Meld[]).push({
    id: meldId,
    kind: "peng",
    tiles: [t1, t2, discard],
    claimed: discard,
  } satisfies PengMeld);

  // 不摸牌轉入出牌階段.
  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, claimed: discard };
}
