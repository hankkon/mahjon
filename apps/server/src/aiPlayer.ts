/**
 * aiPlayer — server-side AI decision module.
 *
 * The server is authoritative: the Room applies every command and auto-wins
 * 合法可胡即自動胡牌, so an AI never needs a "win" decision. It only decides:
 *   - ready (lobby / next round after ended)
 *   - discard (its discard phase)
 *   - reaction (chi / peng / kong / pass during a reaction window, and self
 *     kong during its own discard phase)
 *
 * Three difficulties:
 *   初級 (easy)   — mostly random discards, rarely claims, often passes.
 *   中級 (medium) — tile-value based safe discards, claims when beneficial.
 *   高級 (hard)   — tenpai-aware: simulates every candidate discard and picks
 *                    the one maximizing immediate waits; claims aggressively.
 *
 * All functions are pure — they read Room state directly (server-side, full
 * hand visibility) and return the command payload the controller sends via
 * room.handleCommand(). No socket / protocol imports here.
 */

import type { GameState, Meld, TileInstance, ChiMeld, PengMeld } from "@taiwan-mahjong/rules";
import {
  chiOptions,
  detectWin,
  kongOptions,
  pengOptions,
  tileToId,
  deckRemaining,
} from "@taiwan-mahjong/rules";
import type { Room } from "./room.js";
import { collectPendingKinds } from "./gameLoop.js";

export type AiDifficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_NAMES: Record<AiDifficulty, string> = {
  easy: "AI 初級",
  medium: "AI 中級",
  hard: "AI 高級",
};

/** AI thinking "feel" — small random delay so moves don't look instant. */
export const AI_ACTION_DELAY_MS: Record<AiDifficulty, [number, number]> = {
  easy: [250, 900],
  medium: [200, 700],
  hard: [120, 500],
};

/**
 * Reaction-window delay — deliberately LONGER than general move delay, so a
 * solo human has time to read the 吃/碰/槓/過 hint and click before an AI
 * claims or passes. (General move throttle stays fast; only reactions slow.)
 */
export const AI_REACTION_DELAY_MS: [number, number] = [1500, 2600];

// ---------------------------------------------------------------------------
// Tile helpers (mirror qa-stress — the win-oriented heuristics)
// ---------------------------------------------------------------------------

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

export const ALL_TILE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of NUM_SUITS) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of HONOR_RANKS) ids.push(`honor:${honor}`);
  return ids;
})();

export function fakeTile(id: string): TileInstance {
  const [category, value] = id.split(":");
  if (category === "honor") {
    return { tile: { kind: "honor", honor: value as "dong" }, instanceId: -1 };
  }
  return {
    tile: { kind: "numbered", suit: category as "wan", rank: Number(value) as 1 },
    instanceId: -1,
  };
}

function idSuitRank(id: string): { suit: string; rank: number } | null {
  const [cat, val] = id.split(":");
  if (!cat || !val) return null;
  if (cat === "flower") return null;
  if (cat === "honor") {
    return { suit: "honor", rank: HONOR_RANKS.indexOf(val as (typeof HONOR_RANKS)[number]) };
  }
  if (NUM_SUITS.includes(cat as (typeof NUM_SUITS)[number])) {
    const r = Number(val);
    if (Number.isFinite(r) && r >= 1 && r <= 9) return { suit: cat, rank: r };
  }
  return null;
}

/**
 * How valuable a single tile is toward a win, given the current hand counts.
 * Honors: a pair/triplet of honors is valuable (no runs possible).
 * Numbered: triplets > pairs; neighbors add run potential.
 */
function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0;
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0;
  value += hasLeft && hasRight ? 1 : 0;
  value += hasLeft || hasRight ? 1 : 0;
  return value;
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function handCounts(hand: readonly TileInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of hand) {
    const id = tileToId(t.tile);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Lowest-value tile in the hand (最安全的棄牌). */
function pickWinDiscard(hand: readonly TileInstance[]): TileInstance | undefined {
  if (hand.length === 0) return undefined;
  const counts = handCounts(hand);
  let best: TileInstance | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(tileToId(t.tile), counts);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Highest-value tile (破壞牌 / sabotage — keeps the dealer strong). */
function pickSabotageTile(hand: readonly TileInstance[]): TileInstance | undefined {
  if (hand.length === 0) return undefined;
  const counts = handCounts(hand);
  let best: TileInstance | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(tileToId(t.tile), counts);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// Shanten (向聽數) & Tile Efficiency (牌效) Engine — Taiwan 16-Tile Mahjong
// ---------------------------------------------------------------------------

/**
 * Fast Shanten (向聽數) Calculator for Taiwan 16-tile Mahjong:
 * Target: 5 melds + 1 pair = 16 (or 17 on winning hand).
 * -1 = Complete (Win)
 *  0 = Tenpai (聽牌)
 *  1 = 1-Shanten (一向聽), etc.
 */
export function calculateShanten(
  hand: readonly TileInstance[],
  melds: readonly Meld[] = [],
): number {
  const counts = handCounts(hand);
  const openMeldCount = melds.length;
  const targetMelds = 5 - openMeldCount;

  // 1. Eight Pairs (八對半 / 嚦咕嚦咕) Shanten (only if purely concealed)
  let eightPairShanten = Number.POSITIVE_INFINITY;
  if (openMeldCount === 0) {
    let pairCount = 0;
    for (const c of counts.values()) {
      if (c >= 4) pairCount += 2;
      else if (c >= 2) pairCount += 1;
    }
    eightPairShanten = Math.max(0, 8 - pairCount);
  }

  // 2. Standard 5-melds + 1-pair Shanten
  const suitCounts: Record<string, number[]> = {
    wan: new Array(10).fill(0),
    tiao: new Array(10).fill(0),
    tong: new Array(10).fill(0),
  };
  const honorCounts: number[] = new Array(7).fill(0);

  for (const [id, count] of counts) {
    const sr = idSuitRank(id);
    if (!sr) continue;
    if (sr.suit === "honor") {
      honorCounts[sr.rank] = count;
    } else {
      suitCounts[sr.suit]![sr.rank] = count;
    }
  }

  // Count honors
  let honorMelds = 0;
  let honorPairs = 0;
  for (const c of honorCounts) {
    if (c >= 3) honorMelds += 1;
    else if (c === 2) honorPairs += 1;
  }

  // Decompose numbered suit into candidate melds & partial melds
  function decomposeSuit(arr: number[]): Array<{ melds: number; taatsu: number; pairs: number }> {
    const results: Array<{ melds: number; taatsu: number; pairs: number }> = [];

    function search(idx: number, m: number, t: number, p: number, currentArr: number[]) {
      if (idx > 9) {
        results.push({ melds: m, taatsu: t, pairs: p });
        return;
      }
      if (currentArr[idx] === 0) {
        search(idx + 1, m, t, p, currentArr);
        return;
      }

      // Triplet
      if (currentArr[idx]! >= 3) {
        currentArr[idx]! -= 3;
        search(idx, m + 1, t, p, currentArr);
        currentArr[idx]! += 3;
      }

      // Run (idx, idx+1, idx+2)
      if (idx <= 7 && currentArr[idx]! >= 1 && currentArr[idx + 1]! >= 1 && currentArr[idx + 2]! >= 1) {
        currentArr[idx]! -= 1;
        currentArr[idx + 1]! -= 1;
        currentArr[idx + 2]! -= 1;
        search(idx, m + 1, t, p, currentArr);
        currentArr[idx]! += 1;
        currentArr[idx + 1]! += 1;
        currentArr[idx + 2]! += 1;
      }

      // Pair
      if (currentArr[idx]! >= 2) {
        currentArr[idx]! -= 2;
        search(idx, m, t, p + 1, currentArr);
        currentArr[idx]! += 2;
      }

      // Two-sided / edge run (idx, idx+1)
      if (idx <= 8 && currentArr[idx]! >= 1 && currentArr[idx + 1]! >= 1) {
        currentArr[idx]! -= 1;
        currentArr[idx + 1]! -= 1;
        search(idx, m, t + 1, p, currentArr);
        currentArr[idx]! += 1;
        currentArr[idx + 1]! += 1;
      }

      // Inside run (idx, idx+2)
      if (idx <= 7 && currentArr[idx]! >= 1 && currentArr[idx + 2]! >= 1) {
        currentArr[idx]! -= 1;
        currentArr[idx + 2]! -= 1;
        search(idx, m, t + 1, p, currentArr);
        currentArr[idx]! += 1;
        currentArr[idx + 2]! += 1;
      }

      // Skip tile as isolated
      search(idx + 1, m, t, p, currentArr);
    }

    search(1, 0, 0, 0, [...arr]);
    return results;
  }

  const wanCombos = decomposeSuit(suitCounts.wan!);
  const tiaoCombos = decomposeSuit(suitCounts.tiao!);
  const tongCombos = decomposeSuit(suitCounts.tong!);

  let minStandardShanten = 10;

  for (const w of wanCombos) {
    for (const ti of tiaoCombos) {
      for (const to of tongCombos) {
        const totalMelds = honorMelds + w.melds + ti.melds + to.melds;
        const totalPairs = honorPairs + w.pairs + ti.pairs + to.pairs;
        const totalTaatsu = w.taatsu + ti.taatsu + to.taatsu;

        // With pair as head (雀頭)
        if (totalPairs > 0) {
          const usedMelds = Math.min(targetMelds, totalMelds);
          const remMeldsNeeded = targetMelds - usedMelds;
          const availableTaatsu = totalTaatsu + (totalPairs - 1);
          const usedTaatsu = Math.min(remMeldsNeeded, availableTaatsu);
          const shanten = (targetMelds - usedMelds) * 2 - usedTaatsu - 1;
          if (shanten < minStandardShanten) minStandardShanten = shanten;
        }

        // Without pair as head
        const usedMelds = Math.min(targetMelds, totalMelds);
        const remMeldsNeeded = targetMelds - usedMelds;
        const availableTaatsu = totalTaatsu + totalPairs;
        const usedTaatsu = Math.min(remMeldsNeeded, availableTaatsu);
        const shanten = (targetMelds - usedMelds) * 2 - usedTaatsu;
        if (shanten < minStandardShanten) minStandardShanten = shanten;
      }
    }
  }

  return Math.min(minStandardShanten, eightPairShanten);
}

function countUnseen(
  tid: string,
  hand: readonly TileInstance[],
  melds: readonly Meld[],
  discards: readonly TileInstance[],
): number {
  let seen = 0;
  for (const t of hand) {
    if (tileToId(t.tile) === tid) seen++;
  }
  for (const m of melds) {
    for (const t of m.tiles) {
      if (tileToId(t.tile) === tid) seen++;
    }
  }
  for (const t of discards) {
    if (tileToId(t.tile) === tid) seen++;
  }
  return Math.max(0, 4 - seen);
}

/**
 * Calculate Tile Acceptance (進張數 / Ukeire):
 * Given a hand, count how many unrevealed tiles improve the Shanten, and sum their copies.
 */
export function calculateTileAcceptance(
  hand: readonly TileInstance[],
  melds: readonly Meld[] = [],
  visibleDiscards: readonly TileInstance[] = [],
): { shanten: number; acceptance: number; improvingTiles: string[] } {
  const currentShanten = calculateShanten(hand, melds);
  if (currentShanten <= 0) {
    // Tenpai (0) or Win (-1): evaluate winning wait tiles
    let waitCopies = 0;
    const improving: string[] = [];
    for (const tid of ALL_TILE_IDS) {
      const simulatedHand = [...hand, fakeTile(tid)];
      if (detectWin(simulatedHand, melds).win) {
        improving.push(tid);
        waitCopies += countUnseen(tid, hand, melds, visibleDiscards);
      }
    }
    return { shanten: currentShanten, acceptance: waitCopies, improvingTiles: improving };
  }

  let totalAcceptance = 0;
  const improving: string[] = [];

  for (const tid of ALL_TILE_IDS) {
    const simulatedHand = [...hand, fakeTile(tid)];
    const newShanten = calculateShanten(simulatedHand, melds);
    if (newShanten < currentShanten) {
      improving.push(tid);
      const remaining = countUnseen(tid, hand, melds, visibleDiscards);
      totalAcceptance += remaining;
    }
  }

  return { shanten: currentShanten, acceptance: totalAcceptance, improvingTiles: improving };
}

// ---------------------------------------------------------------------------
// Discard decisions
// ---------------------------------------------------------------------------

export interface DiscardDecision {
  action: "discard";
  tileInstanceId: number;
}

/**
 * Decide which tile to discard for the given difficulty using Tile Efficiency.
 */
export function decideDiscard(
  room: Room,
  seat: number,
  difficulty: AiDifficulty,
): DiscardDecision | null {
  const state = room.state;
  if (!state || state.phase !== "discard" || state.turn !== seat) return null;
  const hand = state.wall.hands[seat];
  if (!hand || hand.length === 0) return null;
  const melds = (state.melds[seat] as Meld[]) ?? [];

  // Collect visible discards for defensive and acceptance accuracy
  const allDiscards: TileInstance[] = [];
  for (const dList of state.discards) {
    if (Array.isArray(dList)) allDiscards.push(...dList);
  }

  let target: TileInstance | undefined;

  if (difficulty === "easy") {
    // 初級: 40% random, 60% lowest-value heuristic
    if (Math.random() < 0.4) {
      target = pickRandom(hand);
    } else {
      target = pickWinDiscard(hand);
    }
  } else if (difficulty === "medium") {
    // 中級: Discard tile that maximizes remaining acceptance
    let best: TileInstance | undefined;
    let bestShanten = Number.POSITIVE_INFINITY;
    let bestAcceptance = -1;

    for (const candidate of hand) {
      const rest = hand.filter((t) => t.instanceId !== candidate.instanceId);
      const ukeire = calculateTileAcceptance(rest, melds, allDiscards);
      if (
        ukeire.shanten < bestShanten ||
        (ukeire.shanten === bestShanten && ukeire.acceptance > bestAcceptance)
      ) {
        bestShanten = ukeire.shanten;
        bestAcceptance = ukeire.acceptance;
        best = candidate;
      }
    }
    // Occasional human jitter (8%)
    if (Math.random() < 0.08 && hand.length > 1) target = pickRandom(hand);
    else target = best ?? pickWinDiscard(hand);
  } else {
    // 高級: Full Shanten + Tile Efficiency + Shape Tie-breaker + Defensive Awareness
    let best: TileInstance | undefined;
    let bestShanten = Number.POSITIVE_INFINITY;
    let bestAcceptance = -1;
    let bestTieScore = Number.NEGATIVE_INFINITY;

    const remainingWall = deckRemaining(state.wall);
    const isLateGame = remainingWall <= 24;

    for (const candidate of hand) {
      const rest = hand.filter((t) => t.instanceId !== candidate.instanceId);
      const ukeire = calculateTileAcceptance(rest, melds, allDiscards);

      // Tie-breaker: tile shape score + defense score
      const cid = tileToId(candidate.tile);
      const shapeScore = -tileValue(cid, handCounts(rest));
      let defenseScore = 0;
      if (isLateGame) {
        // Discarding a tile that's already seen in discards is safe
        const timesSeen = allDiscards.filter((d) => tileToId(d.tile) === cid).length;
        defenseScore = timesSeen * 2;
      }

      const totalTieScore = shapeScore + defenseScore;

      if (
        ukeire.shanten < bestShanten ||
        (ukeire.shanten === bestShanten && ukeire.acceptance > bestAcceptance) ||
        (ukeire.shanten === bestShanten &&
          ukeire.acceptance === bestAcceptance &&
          totalTieScore > bestTieScore)
      ) {
        bestShanten = ukeire.shanten;
        bestAcceptance = ukeire.acceptance;
        bestTieScore = totalTieScore;
        best = candidate;
      }
    }

    target = best ?? pickWinDiscard(hand);
  }

  if (!target) return null;
  return { action: "discard", tileInstanceId: target.instanceId };
}

// ---------------------------------------------------------------------------
// Reaction decisions
// ---------------------------------------------------------------------------

export interface ReactionDecision {
  action: "reaction";
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  handTileIds?: number[];
  pengMeldId?: number;
}

export interface PassDecision {
  action: "pass";
}

/**
 * Decide a reaction (or pass) for the given seat during the reaction window
 * using intelligent Shanten & Meld evaluation.
 */
export function decideReaction(
  room: Room,
  seat: number,
  difficulty: AiDifficulty,
): ReactionDecision | PassDecision | null {
  const state = room.state;
  if (!state || room.status !== "playing") return null;
  const hand = state.wall.hands[seat];
  if (!hand) return null;
  const melds = (state.melds[seat] as Meld[]) ?? [];

  // --- Self kong (closed / add-on) during own discard phase. ---
  if (state.phase === "discard" && state.turn === seat) {
    const kongs = kongOptions(state, seat, false);
    if (kongs.length > 0) {
      const claimP = difficulty === "hard" ? 0.9 : difficulty === "medium" ? 0.7 : 0.4;
      if (Math.random() < claimP) {
        const opt = kongs[0]!;
        return {
          action: "reaction",
          kind: "kong",
          kongType: opt.kongType,
          handTileIds: [...opt.handTileIds],
          pengMeldId: opt.pengMeldId,
        };
      }
    }
    return null;
  }

  // --- Reaction window against the latest discard. ---
  if (state.phase !== "reaction" || state.lastDiscardBy === seat || !state.lastDiscard) {
    return null;
  }
  const pending = collectPendingKinds(state);
  if (!pending.has(seat)) return null;

  const currentShanten = calculateShanten(hand, melds);

  // 1. Kong (open) — highest priority
  const openKongs = kongOptions(state, seat, true);
  if (openKongs.length > 0) {
    const opt = openKongs[0]!;
    const p = difficulty === "hard" ? 0.95 : difficulty === "medium" ? 0.75 : 0.4;
    if (Math.random() < p) {
      return {
        action: "reaction",
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: [...opt.handTileIds],
        pengMeldId: opt.pengMeldId,
      };
    }
  }

  // 2. Peng — intelligent check
  const peng = pengOptions(state, seat);
  if (peng) {
    const claimedTile = state.lastDiscard;
    const isDragon = claimedTile.tile.kind === "honor" &&
      ["zhong", "fa", "bai"].includes((claimedTile.tile as { honor: string }).honor);
    const newHand = hand.filter((t) => !peng.handTileIds.includes(t.instanceId));
    const newMelds: Meld[] = [
      ...melds,
      {
        id: -1,
        kind: "peng" as const,
        tiles: [claimedTile, ...hand.filter((t) => peng.handTileIds.includes(t.instanceId))],
        claimed: claimedTile,
      },
    ];
    const newShanten = calculateShanten(newHand, newMelds);

    let shouldPeng = false;
    if (difficulty === "hard") {
      // Hard: Peng if it improves shanten, or is dragon triplet (fans), or achieves Tenpai
      shouldPeng = newShanten < currentShanten || isDragon || newShanten === 0;
    } else if (difficulty === "medium") {
      shouldPeng = newShanten <= currentShanten;
    } else {
      shouldPeng = Math.random() < 0.35;
    }

    if (shouldPeng) {
      return { action: "reaction", kind: "peng" };
    }
  }

  // 3. Chi — only for 下家
  const chis = chiOptions(state, seat, state.lastDiscard);
  if (chis && chis.length > 0) {
    // Pick the chi option that gives the lowest shanten and highest acceptance
    let bestChi: (typeof chis)[0] | null = null;
    let bestShanten = currentShanten;

    for (const opt of chis) {
      const ids = [opt.handTiles[0]!.instanceId, opt.handTiles[1]!.instanceId];
      const newHand = hand.filter((t) => !ids.includes(t.instanceId));
      const simulatedChiMeld: ChiMeld = {
        id: -1,
        kind: "chi",
        tiles: [opt.handTiles[0]!, opt.handTiles[1]!, state.lastDiscard],
        claimed: state.lastDiscard,
        handTiles: [opt.handTiles[0]!, opt.handTiles[1]!],
      };
      const newMelds: Meld[] = [...melds, simulatedChiMeld];
      const s = calculateShanten(newHand, newMelds);
      if (s < bestShanten) {
        bestShanten = s;
        bestChi = opt;
      }
    }

    let shouldChi = false;
    if (difficulty === "hard") {
      shouldChi = bestChi !== null && (bestShanten < currentShanten || bestShanten === 0);
    } else if (difficulty === "medium") {
      shouldChi = bestChi !== null && bestShanten <= currentShanten && Math.random() < 0.7;
    } else {
      shouldChi = Math.random() < 0.25;
      if (shouldChi) bestChi = chis[0]!;
    }

    if (shouldChi && bestChi) {
      return {
        action: "reaction",
        kind: "chi",
        handTileIds: [bestChi.handTiles[0]!.instanceId, bestChi.handTiles[1]!.instanceId],
      };
    }
  }

  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// Ready decision
// ---------------------------------------------------------------------------

/** True when this AI should mark ready (lobby, or ended → next round). */
export function shouldReady(room: Room, seat: number): boolean {
  if (room.status === "lobby") return true;
  if (room.status === "ended") return true; // first ready resets the room
  return false;
}

export function isAiPlayerId(playerId: string): boolean {
  return playerId.startsWith("ai-");
}

export function aiSeat(room: Room, seat: number): boolean {
  const p = room.players[seat];
  return !!p && isAiPlayerId(p.playerId);
}

// Re-export tileToId for the controller (avoid an extra import there).
export { tileToId };
