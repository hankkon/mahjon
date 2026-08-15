/**
 * Win (胡牌) detection — server-authoritative.
 *
 * 合法可胡即由伺服器自動胡牌 (auto-win): there is no 胡/過 button. The server
 * determines whether a hand (14 tiles for self-draw win, or 13 hand tiles +
 * the last discard for a win off a discard) is a legal winning hand and
 * declares the win automatically.
 *
 * A winning hand in Taiwan 16-tile mahjong consists of:
 *   - 5 sets (melds: 順子 or 刻子/槓子) + 1 pair (將),  OR
 *   - 八對子: 7 pairs + 1 triplet (17 tiles, no open melds).
 */

import type { Meld } from "./types.js";
import type { Tile, TileInstance } from "./tiles.js";
import { tileToId } from "./tiles.js";

export type WinKind = "standard" | "sevenPairs";

export interface WinResult {
  win: boolean;
  kind?: WinKind;
}

/** Count tile occurrences by identity id for a list of instances. */
export function countById(instances: readonly TileInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const inst of instances) {
    const id = tileToId(inst.tile);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Sum the tile counts in a rank→count map (total tiles, not distinct ranks). */
function mapSum(counts: Map<number, number>): number {
  let sum = 0;
  for (const c of counts.values()) sum += c;
  return sum;
}

/**
 * True when the given (already complete) melds + pair form a legal standard
 * winning hand: exactly 4 melds and 1 pair, all melds valid.
 */
function isStandardWin(melds: readonly Tile[][], pair: Tile | null): boolean {
  if (melds.length !== 4 || !pair) return false;
  for (const meld of melds) {
    if (meld.length !== 3) return false;
    if (!isValidMeld(meld)) return false;
  }
  return true;
}

/** A 3-tile meld is valid if it is a run (順) or a triplet (刻). */
export function isValidMeld(tiles: readonly Tile[]): boolean {
  if (tiles.length !== 3) return false;
  const [a, b, c] = tiles;
  if (!a || !b || !c) return false;
  // Triplet: all same identity.
  if (tileToId(a) === tileToId(b) && tileToId(b) === tileToId(c)) return true;
  // Run: same suit, consecutive ranks.
  if (a.kind === "numbered" && b.kind === "numbered" && c.kind === "numbered") {
    if (a.suit !== b.suit || b.suit !== c.suit) return false;
    const ranks = [a.rank, b.rank, c.rank].sort((x, y) => x - y);
    return ranks[1]! === ranks[0]! + 1 && ranks[2]! === ranks[1]! + 1;
  }
  return false;
}

/**
 * Recursively determine whether `counts` (of a single suit) can be partitioned
 * into runs and/or triplets, with the given number of melds to consume.
 *
 * Works purely on the count map (no separate rank-list bookkeeping, which
 * desyncs when a rank appears multiple times): always consumes the smallest
 * remaining rank, trying triplet then run, and backtracks.
 */
function canPartition(counts: Map<number, number>, meldCount: number): boolean {
  if (meldCount === 0) {
    return [...counts.values()].every((c) => c === 0);
  }
  // Find the smallest rank with a positive count.
  let rank = -1;
  for (const r of counts.keys()) {
    if ((counts.get(r) ?? 0) > 0 && (rank === -1 || r < rank)) rank = r;
  }
  if (rank === -1) return false; // no tiles left but melds remain
  const count = counts.get(rank) ?? 0;

  // Try triplet.
  if (count >= 3) {
    counts.set(rank, count - 3);
    if (count - 3 === 0) counts.delete(rank);
    const ok = canPartition(counts, meldCount - 1);
    counts.set(rank, count);
    if (ok) return true;
  }

  // Try run: rank, rank+1, rank+2.
  const c2 = counts.get(rank + 1) ?? 0;
  const c3 = counts.get(rank + 2) ?? 0;
  if (c2 > 0 && c3 > 0) {
    const orig: Array<[number, number]> = [
      [rank, count],
      [rank + 1, c2],
      [rank + 2, c3],
    ];
    counts.set(rank, count - 1);
    counts.set(rank + 1, c2 - 1);
    counts.set(rank + 2, c3 - 1);
    for (const [r, c] of orig) if (c - 1 === 0) counts.delete(r);
    const ok = canPartition(counts, meldCount - 1);
    for (const [r, c] of orig) counts.set(r, c);
    if (ok) return true;
  }
  return false;
}

/**
 * Detect a winning hand from a list of hand tile instances (already includes
 * any claimed discard for a win-off-discard), plus the player's open melds.
 */
export function detectWin(hand: readonly TileInstance[], openMelds: readonly Meld[]): WinResult {
  const kongCount = openMelds.filter((m) => m.kind === "kong").length;
  const total = hand.length + openMelds.reduce((acc, m) => acc + m.tiles.length, 0);
  // Taiwan 16-tile mahjong winning hand = 17 tiles + 1 per kong (each kong
  // meld is 4 tiles but counts as one group). Base: 5 groups (melds) + 1 pair
  // = 5×3 + 2 = 17. A kong adds one extra tile: total = 17 + kongCount.
  if (total !== 17 + kongCount) return { win: false };

  // --- Seven pairs (八對子): 7 pairs + 1 triplet = 17 tiles, concealed. ---
  if (openMelds.length === 0 && trySevenPairs(hand)) {
    return { win: true, kind: "sevenPairs" };
  }

  // --- Standard ---
  const counts = countById(hand);
  // Try each candidate pair.
  for (const [pairId, pairCount] of counts) {
    if (pairCount < 2) continue;
    // Remove the pair.
    const working = new Map(counts);
    working.set(pairId, (working.get(pairId) ?? 0) - 2);
    if ((working.get(pairId) ?? 0) === 0) working.delete(pairId);
    // Split counts by suit. Tile totals are derived from each suit's rank→count
    // map (NOT from a distinct-rank list, which desyncs when a rank appears
    // more than once as a triplet).
    const numberedCounts: Array<{ suit: string; map: Map<number, number> }> = [];
    const honorCounts: Map<string, number> = new Map();
    for (const [id, c] of working) {
      const [category, value] = id.split(":");
      if (category === "honor") {
        honorCounts.set(id, c);
      } else if (category === "wan" || category === "tiao" || category === "tong") {
        const suitEntry = numberedCounts.find((e) => e.suit === category);
        if (suitEntry) {
          suitEntry.map.set(Number(value), c);
        } else {
          numberedCounts.push({
            suit: category,
            map: new Map([[Number(value), c]]),
          });
        }
      }
    }
    // Honours must be triplets only.
    let valid = true;
    for (const [, c] of honorCounts) {
      if (c !== 3 && c !== 0) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    const requiredMelds = 5 - openMelds.length;
    // Total numbered tiles must be divisible by 3 to form complete melds.
    const numberedTotal = numberedCounts.reduce((acc, e) => acc + mapSum(e.map), 0);
    if (numberedTotal % 3 !== 0) continue;
    let partitionable = true;
    for (const entry of numberedCounts) {
      if (!canPartition(entry.map, mapSum(entry.map) / 3)) {
        partitionable = false;
        break;
      }
    }
    if (!partitionable) continue;
    // Count melds formed from numbered tiles + honor triplets.
    const honorTripletCount = [...honorCounts.values()].filter((c) => c === 3).length;
    const numberedMelds = numberedTotal / 3;
    if (numberedMelds + honorTripletCount === requiredMelds) {
      return { win: true, kind: "standard" };
    }
  }
  return { win: false };
}

/**
 * Seven pairs (八對子) in Taiwan 16-tile mahjong: 7 complete pairs + 1 triplet
 * (the winning tile completes the final pair into a triplet) = 17 tiles, with
 * no open melds.
 */
function trySevenPairs(hand: readonly TileInstance[]): boolean {
  if (hand.length !== 17) return false;
  const counts = countById(hand);
  if (counts.size !== 8) return false;
  const values = [...counts.values()].sort((a, b) => a - b);
  // 7 pairs (2 each) + 1 triplet (3).
  for (let i = 0; i < 7; i++) {
    if (values[i] !== 2) return false;
  }
  return values[7] === 3;
}

/**
 * Build the full list of 14 (or 17 with drawn) tile instances for a winning
 * hand: the 16-tile hand keeps the pair + 4 melds = 17 total on win.
 * Provided for scoring; returns the hand + meld tiles flattened.
 */
export function allWinTiles(
  hand: readonly TileInstance[],
  openMelds: readonly Meld[],
): TileInstance[] {
  const out: TileInstance[] = [...hand];
  for (const m of openMelds) out.push(...m.tiles);
  return out;
}
