/**
 * Game state construction and low-level state transitions.
 *
 * Authoritative Domain — `packages/rules`.
 */

import type { RngFn } from "./rng.js";
import type { TileInstance } from "./tiles.js";
import type { Variant, Seat, WallState } from "./wall.js";
import { createDeal } from "./wall.js";
import type { GameState, Meld } from "./types.js";

export type { Variant, Seat };

/** Build a fresh dealt game: wall dealt, dealer to discard.
 * When `diceValues` is provided the wall is opened by the Taiwan dice rule
 * (骰子定門) before the deal. */
export function createGameState(
  variant: Variant,
  rng: RngFn,
  dealer: Seat,
  dealerStreak = 0,
  diceValues?: readonly number[],
): GameState {
  const wall: WallState = createDeal(variant, rng, dealer, diceValues);
  return {
    wall,
    melds: [[], [], [], []],
    dealer,
    turn: dealer,
    phase: "discard",
    discards: [],
    discardsBySeat: [[], [], [], []],
    dealerStreak,
  };
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

/** Cyclic distance from `from` to `to` (0..3), used for reaction ordering. */
export function seatDistance(from: number, to: number): number {
  return (to - from + 4) % 4;
}

export function removeByInstanceId(hand: TileInstance[], instanceId: number): TileInstance {
  const idx = hand.findIndex((t) => t.instanceId === instanceId);
  if (idx === -1) {
    throw new Error(`Tile instance ${instanceId} not found in hand`);
  }
  const [tile] = hand.splice(idx, 1);
  return tile as TileInstance;
}

/** Next free meld id (max existing + 1). */
export function nextMeldId(state: GameState): number {
  let max = 0;
  for (const list of state.melds) {
    for (const m of list) max = Math.max(max, m.id);
  }
  return max + 1;
}

/**
 * Discard a tile from the player's hand into the pool.
 * Server layer is responsible for validating that it is the player's turn.
 */
export function performDiscard(state: GameState, seat: Seat, tileInstanceId: number): TileInstance {
  const hand = state.wall.hands[seat];
  const tile = removeByInstanceId(hand, tileInstanceId);
  state.discards.push(tile);
  (state.discardsBySeat[seat] as TileInstance[]).push(tile);
  state.lastDiscard = tile;
  state.lastDiscardBy = seat;
  state.phase = "reaction";
  return tile;
}

/** Remove a claimed discard from its owner's per-seat river (fall back to
 * whichever river contains it). Keeps discardsBySeat consistent with the pool. */
export function removeFromRiver(state: GameState, discard: TileInstance): void {
  for (const river of state.discardsBySeat) {
    const idx = river.indexOf(discard);
    if (idx !== -1) {
      river.splice(idx, 1);
      return;
    }
  }
}

/** 合法即自動胡牌 — the server terminates the game and enters settlement. */
export function declareWin(state: GameState, winner: Seat, selfDraw: boolean): GameState {
  state.winner = winner;
  state.turn = winner;
  state.phase = "ended";
  return state;
}

export function meldsAt(state: GameState, seat: Seat): Meld[] {
  return state.melds[seat];
}

/** Total tiles accounted for across hands, flowers, open melds, discards, and remaining wall. */
export function accountedGameStateTiles(state: GameState): number {
  const inHands = state.wall.hands.reduce((acc, h) => acc + h.length, 0);
  const inFlowers = state.wall.flowers.reduce((acc, f) => acc + f.length, 0);
  const inMelds = state.melds.reduce(
    (acc, ms) => acc + ms.reduce((macc, m) => macc + m.tiles.length, 0),
    0,
  );
  const inDiscards = state.discards.length;
  const inWallHead = Math.max(0, state.wall.tailStart - state.wall.headCursor);
  const inWallDeck = Math.max(0, state.wall.wall.length - state.wall.deckCursor);
  return inHands + inFlowers + inMelds + inDiscards + inWallHead + inWallDeck;
}
