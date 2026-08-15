/**
 * Chi (吃牌) — server-authoritative Domain logic.
 *
 * 限吃上家最新數牌棄牌: only the player to the left (上家) of the discarder may
 * chi, and only when the discarded tile is a numbered suit tile (數牌).
 * Chi uses exactly two physical tiles from the claimant's hand to form a run
 * (順子) with the claimed discard. The claimant does NOT draw a new tile and
 * moves straight to the discard phase (不摸牌轉入出牌階段).
 */

import type { GameState, Meld } from "./types.js";
import type { TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";
import { nextMeldId, removeByInstanceId, removeFromRiver } from "./game.js";

/** An eligible two-tile hand combination that completes a run with `discard`. */
export interface ChiOption {
  /** The two hand tiles to combine with the discard. */
  handTiles: readonly [TileInstance, TileInstance];
  /** The completed run (ordered ascending, discard included). */
  run: readonly TileInstance[];
}

/** Ranks of the two hand tiles relative to the discard to complete a run. */
const CHI_PATTERNS: ReadonlyArray<readonly [number, number]> = [
  [-2, -1], // discard + 2 below
  [-1, 1], // discard in the middle
  [1, 2], // discard + 2 above
];

/**
 * Enumerate all legal chi options for a discard, or null when the claimant is
 * not the 上家 (the seat directly after the discarder).
 */
export function chiOptions(
  state: GameState,
  seat: number,
  discard: TileInstance,
): ChiOption[] | null {
  const lastDiscardBy = state.lastDiscardBy;
  if (lastDiscardBy === undefined || lastDiscardBy === null) return null;
  // Chi only by the player immediately after (上家 = next seat).
  if ((lastDiscardBy + 1) % 4 !== seat) return null;
  const tile = discard.tile;
  if (tile.kind !== "numbered") return null;
  const suit = tile.suit;
  const rank = tile.rank;

  const hand = state.wall.hands[seat] as TileInstance[];
  // Group hand tiles by suit and rank to find matching pairs.
  const byRank = new Map<number, TileInstance[]>();
  for (const inst of hand) {
    if (inst.tile.kind === "numbered" && inst.tile.suit === suit) {
      const list = byRank.get(inst.tile.rank) ?? [];
      list.push(inst);
      byRank.set(inst.tile.rank, list);
    }
  }

  const options: ChiOption[] = [];
  const seen = new Set<string>();
  for (const [d1, d2] of CHI_PATTERNS) {
    const r1 = rank + d1;
    const r2 = rank + d2;
    if (r1 < 1 || r1 > 9 || r2 < 1 || r2 > 9) continue;
    const list1 = byRank.get(r1);
    const list2 = byRank.get(r2);
    if (!list1 || !list2 || list1.length === 0 || list2.length === 0) continue;
    for (const t1 of list1) {
      for (const t2 of list2) {
        const key = `${t1.instanceId}:${t2.instanceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({
          handTiles: [t1, t2],
          run: [t1, discard, t2].sort(
            (a, b) => (a.tile.kind === "numbered" ? a.tile.rank : 0) - (b.tile.kind === "numbered" ? b.tile.rank : 0),
          ),
        });
      }
    }
  }
  return options;
}

export interface ChiResult {
  meldId: number;
  /** The discard instance consumed by this meld. */
  claimed: TileInstance;
}

/**
 * Perform a chi meld. Validates that the option is legal, removes the two hand
 * tiles, moves the claimed discard out of the pool into the meld, appends the
 * meld, and moves the player straight to the discard phase (no draw).
 */
export function performChi(
  state: GameState,
  seat: number,
  option: ChiOption,
): ChiResult {
  const discard = state.lastDiscard;
  if (!discard) {
    throw new Error("No discard available to chi");
  }
  const hand = state.wall.hands[seat] as TileInstance[];
  const [t1, t2] = option.handTiles;
  const inHand1 = hand.some((t) => t.instanceId === t1.instanceId);
  const inHand2 = hand.some((t) => t.instanceId === t2.instanceId);
  if (!inHand1 || !inHand2) {
    throw new Error("Chi hand tiles must be in the claimant's hand");
  }

  // Remove the claimed discard from the pool (and its owner's river).
  const discardIdx = state.discards.indexOf(discard);
  if (discardIdx === -1) {
    throw new Error("Claimed discard not in the discard pool");
  }
  state.discards.splice(discardIdx, 1);
  removeFromRiver(state, discard);
  removeByInstanceId(hand, t1.instanceId);
  removeByInstanceId(hand, t2.instanceId);

  const meldId = nextMeldId(state);
  (state.melds[seat] as Meld[]).push({
    id: meldId,
    kind: "chi",
    tiles: [t1, t2, discard],
    claimed: discard,
    handTiles: [t1, t2],
  });

  // 不摸牌轉入出牌階段.
  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, claimed: discard };
}

/** Serialize an option for wire/debug purposes. */
export function chiOptionToIds(option: ChiOption): string {
  return option.handTiles.map((t) => t.instanceId).join(",") + "|" + tileToId(option.run[0]?.tile ?? option.handTiles[0]!.tile);
}
