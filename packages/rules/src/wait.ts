/**
 * Wait analysis (聽牌分析) — server-authoritative.
 *
 * Given the winning hand and the tile that completed it, determine:
 *  - every face that would have completed the hand (聽牌張), and
 *  - the role the winning tile plays across all winning decompositions
 *    (單吊 SINGLE / 邊張 EDGE / 坎張 CLOSED / OPEN / TRIPLET).
 *
 * The Taiwan 邊張/坎張/單吊 fans only apply on a SINGLE wait (單聽) where the
 * winning tile's role is exclusive — mirrored from the authoritative reference
 * implementation (V1 tai-evaluation).
 */

import type { Meld } from "./types.js";
import type { TileInstance } from "./tiles.js";
import { tileFromId, tileToId } from "./tiles.js";
import { countById, detectWin } from "./win.js";

export type WaitRole = "SINGLE" | "EDGE" | "CLOSED" | "OPEN" | "TRIPLET";

export interface WaitAnalysis {
  /** Identity id of the winning tile (e.g. "wan:5", "honor:dong"). */
  winningTileId: string;
  /** Every face that would complete the pre-win hand into a standard win. */
  waitingFaceIds: string[];
  /** True when the hand waits on exactly one face (單聽). */
  singleWait: boolean;
  /** Roles the winning tile plays across all winning decompositions. */
  winningRoles: ReadonlySet<WaitRole>;
}

/** All 34 standard faces (27 suited + 7 honors; flowers excluded). */
const ALL_STANDARD_FACE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of ["wan", "tiao", "tong"] as const) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const) {
    ids.push(`honor:${honor}`);
  }
  return ids;
})();

/** A complete decomposition of a hand into groups (triplets/runs) + a pair. */
export interface Grouping {
  groups: TileInstance[][];
  pair: TileInstance[] | null;
}

function isRunGroup(group: readonly TileInstance[]): boolean {
  if (group.length !== 3) return false;
  const [a, b, c] = group;
  if (!a || !b || !c) return false;
  if (a.tile.kind !== "numbered" || b.tile.kind !== "numbered" || c.tile.kind !== "numbered") {
    return false;
  }
  if (a.tile.suit !== b.tile.suit || b.tile.suit !== c.tile.suit) return false;
  const ranks = [a.tile.rank, b.tile.rank, c.tile.rank].sort((x, y) => x - y);
  return ranks[1]! === ranks[0]! + 1 && ranks[2]! === ranks[1]! + 1;
}

/**
 * Enumerate every way to partition `instances` into groups (runs/triplets)
 * plus exactly one pair. Hand sizes are 14 or 17 (5 groups + pair), so the
 * recursion always ends with 2 remaining tiles forming the pair.
 */
export function enumerateGroupings(instances: readonly TileInstance[]): Grouping[] {
  const byFace = new Map<string, TileInstance[]>();
  for (const inst of instances) {
    const id = tileToId(inst.tile);
    const list = byFace.get(id) ?? [];
    list.push(inst);
    byFace.set(id, list);
  }
  // Working copy so each branch mutates freely.
  const work = new Map<string, TileInstance[]>();
  for (const [id, list] of byFace) work.set(id, [...list]);

  const out: Grouping[] = [];
  const groups: TileInstance[][] = [];

  function smallestFace(): string | null {
    let best: string | null = null;
    for (const [id, list] of work) {
      if (list.length === 0) continue;
      if (best === null || id < best) best = id;
    }
    return best;
  }

  // Recursively consume groups (triplets/runs) and exactly one pair. The pair
  // may be taken early (a face with exactly 2 copies can only be the pair), so
  // the terminal state is 0 tiles remaining WITH a pair already reserved.
  function rec(remaining: number, havePair: boolean, pair: TileInstance[] | null): void {
    if (remaining === 0) {
      if (havePair) out.push({ groups: groups.map((g) => [...g]), pair });
      return;
    }
    if (remaining < 3 && !(remaining === 2 && !havePair)) return;

    const id = smallestFace();
    if (id === null) return;
    const list = work.get(id)!;
    const tile = list[0]!;

    // Triplet: three copies of the same face.
    if (list.length >= 3) {
      const removed = list.splice(0, 3);
      groups.push(removed);
      rec(remaining - 3, havePair, pair);
      groups.pop();
      list.unshift(...removed);
    }

    // Run: one copy each of rank, rank+1, rank+2 in the same suit.
    if (tile.tile.kind === "numbered") {
      const suit = tile.tile.suit;
      const rank = tile.tile.rank;
      if (rank + 2 <= 9) {
        const r2 = work.get(`${suit}:${rank + 1}`);
        const r3 = work.get(`${suit}:${rank + 2}`);
        if (r2 && r2.length >= 1 && r3 && r3.length >= 1) {
          const a = list.shift()!;
          const b = r2.shift()!;
          const c = r3.shift()!;
          groups.push([a, b, c]);
          rec(remaining - 3, havePair, pair);
          groups.pop();
          list.unshift(a);
          r2.unshift(b);
          r3.unshift(c);
        }
      }
    }

    // Pair: two copies of the same face (reserved once).
    if (!havePair && list.length >= 2) {
      const removed = list.splice(0, 2);
      rec(remaining - 2, true, removed);
      list.unshift(...removed);
    }
  }

  rec(instances.length, false, null);
  return out;
}


/** The role the winning tile plays in one specific decomposition (or null). */
function winningTileRoleInGrouping(grouping: Grouping, winningTile: TileInstance): WaitRole | null {
  const winId = winningTile.instanceId;
  if (grouping.pair?.some((t) => t.instanceId === winId)) return "SINGLE";
  for (const group of grouping.groups) {
    if (!group.some((t) => t.instanceId === winId)) continue;
    // Triplet group (all three identical).
    if (
      tileToId(group[0]!.tile) === tileToId(group[1]!.tile) &&
      tileToId(group[1]!.tile) === tileToId(group[2]!.tile)
    ) {
      return "TRIPLET";
    }
    if (winningTile.tile.kind !== "numbered") return null;
    const ranks = group
      .map((t) => (t.tile.kind === "numbered" ? t.tile.rank : -1))
      .sort((a, b) => a - b);
    const start = ranks[0]!;
    const winRank = winningTile.tile.rank;
    // 邊張: completes 123 at the 3 end, or 789 at the 7 end.
    if ((start === 1 && winRank === 3) || (start === 7 && winRank === 7)) return "EDGE";
    // 坎張: completes the middle of a run (e.g. 2-4 waiting 3).
    if (winRank === start + 1) return "CLOSED";
    return "OPEN";
  }
  return null;
}

/**
 * Analyze the wait for a winning hand.
 *
 * `hand` must be the FULL winning hand (including `winningTile`), `melds` the
 * winner's open melds. Returns null when the winning tile is absent from the
 * hand or the hand is not a standard-shape win (e.g. 八對子), in which case
 * the wait-based fans (平胡/邊張/坎張/單吊) do not apply.
 */
export function analyzeWait(
  hand: readonly TileInstance[],
  melds: readonly Meld[],
  winningTile: TileInstance,
): WaitAnalysis | null {
  const winIdx = hand.findIndex((t) => t.instanceId === winningTile.instanceId);
  if (winIdx === -1) return null;
  const full = [...hand];
  const preWin = [...full.slice(0, winIdx), ...full.slice(winIdx + 1)];

  const groupings = enumerateGroupings(full);
  if (groupings.length === 0) return null; // not a standard-shape win

  const winningRoles = new Set<WaitRole>();
  for (const grouping of groupings) {
    const role = winningTileRoleInGrouping(grouping, winningTile);
    if (role !== null) winningRoles.add(role);
  }

  // Waiting faces: every face (with an unused physical copy) that completes
  // the pre-win hand into a standard win.
  const usedCounts = countById(full);
  const waitingFaceIds: string[] = [];
  for (const faceId of ALL_STANDARD_FACE_IDS) {
    if ((usedCounts.get(faceId) ?? 0) >= 4) continue; // no physical copy left
    const candidate: TileInstance = { tile: tileFromId(faceId), instanceId: -1 };
    const result = detectWin([...preWin, candidate], melds);
    if (result.win && result.kind === "standard") waitingFaceIds.push(faceId);
  }

  return {
    winningTileId: tileToId(winningTile.tile),
    waitingFaceIds,
    singleWait: waitingFaceIds.length === 1,
    winningRoles,
  };
}

/** True when the analysis shows an exclusive single wait for `role`. */
export function hasExclusiveWaitRole(analysis: WaitAnalysis, role: WaitRole): boolean {
  return (
    analysis.singleWait &&
    analysis.waitingFaceIds[0] === analysis.winningTileId &&
    analysis.winningRoles.size === 1 &&
    analysis.winningRoles.has(role)
  );
}

/** True when every group in the winning hand can be a sequence (平胡 structure). */
export function hasAllChowsStructure(
  hand: readonly TileInstance[],
  melds: readonly Meld[],
): boolean {
  for (const m of melds) {
    if (m.kind !== "chi") return false;
  }
  const groupings = enumerateGroupings(hand);
  return groupings.some((g) => g.groups.every(isRunGroup));
}
