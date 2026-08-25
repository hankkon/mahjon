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
import { createDiceResult, type DiceResult } from "./dice.js";
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

/** One-shot convenience: build wall + deal for a given variant & dealer.
 * When `diceValues` is provided, the wall is opened by the Taiwan dice rule
 * (骰子定門) before the deal — the head starts at the dice break point. */
export function createDeal(
  variant: Variant,
  rng: RngFn,
  dealerIndex: Seat,
  diceValues?: readonly number[],
): WallState {
  const state = createWall(variant, rng);
  if (diceValues) applyWallOpening(state, dealerIndex, diceValues);
  dealInitial(state, dealerIndex);
  return state;
}

export interface WallOpening {
  diceResult: DiceResult;
  /** Seat counted to from the dealer (dice total minus one, mod 4). */
  openingSeat: Seat;
  openingSeatOffset: number;
  /** 2 tiles per stack, 72 stacks (north) / 68 stacks (south). */
  stacksPerSide: number;
  totalStacks: number;
  /** Stacks left uncut from the opening seat's right edge (dice total). */
  stacksToLeave: number;
  openingCountingOriginStackIndex: number;
  breakAfterStackIndex: number;
  /** First stack of the normal head draw order (circular index). */
  normalDrawStartStackIndex: number;
}

/**
 * TAIWAN_WALL_OPENING_V1 — 台灣骰子定門.
 *
 * Rearranges the shuffled wall so normal head draws start at the dice break
 * point: the dealer rolls three dice; counting `total` stacks from the right
 * edge of the opening seat's wall (openingSeat = dealer + (total−1) mod 4),
 * the wall breaks there and normal draws traverse the remaining stacks in
 * ascending circular order. The last 16 tiles of the resolved order stay the
 * reserved replacement tail (尾 16 張), preserving the double-cursor model.
 */
export function applyWallOpening(
  state: WallState,
  dealer: Seat,
  diceValues: readonly number[],
): WallOpening {
  const diceResult = createDiceResult(diceValues);
  const total = diceResult.total;
  const totalStacks = state.wall.length / 2;
  if (!Number.isInteger(totalStacks)) {
    throw new Error("Wall must have an even tile count for stacking");
  }
  const stacksPerSide = totalStacks / 4;
  if (!Number.isInteger(stacksPerSide)) {
    throw new Error("Wall must divide into four equal sides");
  }

  const openingSeatOffset = (total - 1) % 4;
  const openingSeat = ((dealer + openingSeatOffset) % 4) as Seat;
  const openingCountingOriginStackIndex = openingSeat * stacksPerSide;
  const stacksToLeave = total;
  const normalDrawStartStackIndex =
    (openingCountingOriginStackIndex + stacksToLeave) % totalStacks;
  const breakAfterStackIndex =
    (normalDrawStartStackIndex - 1 + totalStacks) % totalStacks;

  const wall = state.wall;
  const reordered: TileInstance[] = [];
  for (let offset = 0; offset < totalStacks; offset++) {
    const stackIndex = (normalDrawStartStackIndex + offset) % totalStacks;
    const first = wall[stackIndex * 2];
    const second = wall[stackIndex * 2 + 1];
    if (!first || !second) {
      throw new Error(`Wall stack ${stackIndex} is incomplete`);
    }
    reordered.push(first, second);
  }

  state.wall = reordered;
  state.headCursor = 0;
  state.tailStart = reordered.length - TAIL_SIZE;
  state.deckCursor = state.tailStart;

  return {
    diceResult,
    openingSeat,
    openingSeatOffset,
    stacksPerSide,
    totalStacks,
    stacksToLeave,
    openingCountingOriginStackIndex,
    breakAfterStackIndex,
    normalDrawStartStackIndex,
  };
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
