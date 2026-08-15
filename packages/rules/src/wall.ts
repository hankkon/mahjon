/**
 * Wall, deal, double-cursor tail and continuous flower replacement —
 * IMMEDIATE_TAIL_CHAIN_V1.
 *
 * Authoritative Domain — `packages/rules`.
 * The wall owns all physical tiles and the two cursors:
 *  - headCursor  (牆前游標): normal turn draws
 *  - deckCursor  (牌池游標): replacement draws (flowers / kongs) from the fixed
 *    reserved tail of 16 tiles.
 */

import type { RngFn } from "./rng.js";
import { shuffle } from "./rng.js";
import { TAIL_SIZE, buildDeck, type Tile, type TileInstance } from "./tiles.js";

export type Variant = "north" | "south";
export type Seat = 0 | 1 | 2 | 3;

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const PLAYER_COUNT = 4;

export interface WallState {
  variant: Variant;
  /** All physical tiles in draw order (head → tail). Immutable after creation. */
  wall: readonly TileInstance[];
  /** Next index available for a normal (head) draw. */
  headCursor: number;
  /** Start index of the fixed 16-tile reserved tail. */
  tailStart: number;
  /** Next index available for a replacement (deck) draw. */
  deckCursor: number;
  /** Each player's hand tiles (flowers never stay here). */
  hands: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  /** Each player's collected flowers (補花). */
  flowers: [TileInstance[], TileInstance[], TileInstance[], TileInstance[]];
  /** True once initial deal incl. flower chain is complete. */
  dealComplete: boolean;
}

function handAt(state: WallState, seat: Seat): TileInstance[] {
  return state.hands[seat];
}

function flowersAt(state: WallState, seat: Seat): TileInstance[] {
  return state.flowers[seat];
}

/** Draw the next tile from the head (never touches the reserved tail). */
export function drawFromHead(state: WallState): TileInstance {
  if (state.headCursor >= state.tailStart) {
    throw new Error("Wall exhausted: no tiles left for a normal draw");
  }
  const tile = state.wall[state.headCursor];
  if (!tile) {
    throw new Error(`Head cursor out of range: ${state.headCursor}`);
  }
  state.headCursor += 1;
  return tile;
}

/** Draw the next replacement tile from the deck cursor (reserved tail region). */
export function drawFromDeck(state: WallState): TileInstance {
  if (state.deckCursor >= state.wall.length) {
    throw new Error("Deck exhausted: no replacement tiles left");
  }
  const tile = state.wall[state.deckCursor];
  if (!tile) {
    throw new Error(`Deck cursor out of range: ${state.deckCursor}`);
  }
  state.deckCursor += 1;
  return tile;
}

/**
 * IMMEDIATE_TAIL_CHAIN_V1 — 北部連續補花.
 * Removes every flower from the player's hand and immediately draws one
 * replacement from the deck cursor per flower, chaining until the hand holds
 * no flowers. Hand size is preserved; only the reserved tail is consumed.
 */
export function replaceFlowersChain(state: WallState, seat: Seat): TileInstance[] {
  const hand = handAt(state, seat);
  const drawn: TileInstance[] = [];
  while (true) {
    const idx = hand.findIndex((t) => t.tile.kind === "flower");
    if (idx === -1) break;
    const [flower] = hand.splice(idx, 1);
    if (!flower) break;
    flowersAt(state, seat).push(flower);
    const replacement = drawFromDeck(state);
    hand.push(replacement);
    drawn.push(replacement);
  }
  return drawn;
}

/** Create a fresh shuffled wall (with unique instance ids) for a variant. */
export function createWall(variant: Variant, rng: RngFn): WallState {
  // Assign instance ids BEFORE shuffling so each physical tile keeps its
  // stable identity regardless of its shuffled position.
  const instances: TileInstance[] = buildDeck(variant).map((tile, i) => ({ tile, instanceId: i }));
  shuffle(instances, rng);
  const wall = instances;
  const tailStart = wall.length - TAIL_SIZE;
  return {
    variant,
    wall,
    headCursor: 0,
    tailStart,
    deckCursor: tailStart,
    hands: [[], [], [], []],
    flowers: [[], [], [], []],
    dealComplete: false,
  };
}

/** Deal the initial hands: dealer 17, others 16, then run the flower chain. */
export function dealInitial(state: WallState, dealerIndex: Seat): WallState {
  if (state.dealComplete) {
    throw new Error("Initial deal already completed");
  }
  // 4 rounds of 4 → 16 tiles each.
  for (let round = 0; round < 16; round++) {
    for (const seat of SEATS) {
      handAt(state, seat).push(drawFromHead(state));
    }
  }
  // Dealer's 17th tile.
  handAt(state, dealerIndex).push(drawFromHead(state));

  // Continuous flower replacement for every player (IMMEDIATE_TAIL_CHAIN_V1).
  for (const seat of SEATS) {
    replaceFlowersChain(state, seat);
  }

  state.dealComplete = true;
  return state;
}

/** One-shot convenience: build wall + deal for a given variant & dealer. */
export function createDeal(
  variant: Variant,
  rng: RngFn,
  dealerIndex: Seat,
): WallState {
  const state = createWall(variant, rng);
  dealInitial(state, dealerIndex);
  return state;
}

/** Normal turn draw: head tile + immediate flower chain if needed. */
export function drawTile(state: WallState, seat: Seat): TileInstance {
  const tile = drawFromHead(state);
  handAt(state, seat).push(tile);
  replaceFlowersChain(state, seat);
  return tile;
}

/** Number of tiles still available for normal head draws. */
export function headRemaining(state: WallState): number {
  return state.tailStart - state.headCursor;
}

/** Number of replacement tiles still available in the reserved tail region. */
export function deckRemaining(state: WallState): number {
  return state.wall.length - state.deckCursor;
}

/** Total tiles currently accounted for (hands + flowers + wall remnants). */
export function accountedTiles(state: WallState): number {
  const inHands = state.hands.reduce((acc, h) => acc + h.length, 0);
  const inFlowers = state.flowers.reduce((acc, f) => acc + f.length, 0);
  return inHands + inFlowers + headRemaining(state) + deckRemaining(state);
}

/** Collect every tile instance currently present in the game state. */
export function allTileInstances(state: WallState): TileInstance[] {
  const instances: TileInstance[] = [];
  for (const hand of state.hands) instances.push(...hand);
  for (const flower of state.flowers) instances.push(...flower);
  for (let i = state.headCursor; i < state.tailStart; i++) {
    const t = state.wall[i];
    if (t) instances.push(t);
  }
  for (let i = state.deckCursor; i < state.wall.length; i++) {
    const t = state.wall[i];
    if (t) instances.push(t);
  }
  return instances;
}
