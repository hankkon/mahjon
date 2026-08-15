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

import type { GameState, Meld, TileInstance } from "@taiwan-mahjong/rules";
import { chiOptions, detectWin, kongOptions, pengOptions, tileToId } from "@taiwan-mahjong/rules";
import type { Room } from "./room.js";

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

// ---------------------------------------------------------------------------
// Tile helpers (mirror qa-stress — the win-oriented heuristics)
// ---------------------------------------------------------------------------

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

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
// Tenpai (聽牌) evaluation — the hard AI's discard core
// ---------------------------------------------------------------------------

/** All 34 tile identities (27 numbered + 7 honors) — the tenpai wait space. */
const ALL_TILE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of NUM_SUITS) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of HONOR_RANKS) ids.push(`honor:${honor}`);
  return ids;
})();

/** A bare TileInstance for a tile identity (instanceId unused for detection). */
function fakeTile(id: string): TileInstance {
  const [category, value] = id.split(":");
  if (category === "honor") {
    return { tile: { kind: "honor", honor: value as "dong" }, instanceId: -1 };
  }
  return { tile: { kind: "numbered", suit: category as "wan", rank: Number(value) as 1 }, instanceId: -1 };
}

function isTenpai(hand: readonly TileInstance[], melds: readonly Meld[]): boolean {
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) return true;
    }
  }
  return false;
}

/** Number of distinct wait tiles that make `hand` a win (0 = not tenpai). */
function waitCount(hand: readonly TileInstance[], melds: readonly Meld[]): number {
  let count = 0;
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) {
        count++;
        break; // one wait identity per discarded tile
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Discard decisions
// ---------------------------------------------------------------------------

export interface DiscardDecision {
  action: "discard";
  tileInstanceId: number;
}

/**
 * Decide which tile to discard for the given difficulty.
 * `hand` must contain the tile to be discarded (the AI reads it from state).
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
  const melds = state.melds[seat] as Meld[];

  let target: TileInstance | undefined;

  if (difficulty === "easy") {
    // 初級: 70% random, 30% lowest-value (keeps it beatable but not braindead).
    if (Math.random() < 0.7) target = pickRandom(hand);
    else target = pickWinDiscard(hand);
  } else if (difficulty === "medium") {
    // 中級: tile-value based — discard the lowest-value tile; occasionally
    // risk a random discard so it stays human.
    target = pickWinDiscard(hand);
    if (Math.random() < 0.12 && hand.length > 1) target = pickRandom(hand);
  } else {
    // 高級: tenpai-aware. Try every discard; prefer one that immediately
    // tenpais with the most waits. Otherwise keep the highest tenpai progress.
    let best: TileInstance | undefined;
    let bestWaits = -1;
    let bestFallbackScore = Number.NEGATIVE_INFINITY;
    for (const candidate of hand) {
      const rest = hand.filter((t) => t.instanceId !== candidate.instanceId);
      const waits = waitCount(rest, melds);
      if (waits > bestWaits) {
        bestWaits = waits;
        best = candidate;
        bestFallbackScore = -tileValue(tileToId(candidate.tile), handCounts(rest));
      } else if (waits === bestWaits) {
        // Tie: prefer discarding the least valuable tile (keep strong shapes).
        const score = -tileValue(tileToId(candidate.tile), handCounts(rest));
        if (score > bestFallbackScore) {
          bestFallbackScore = score;
          best = candidate;
        }
      }
    }
    target = best;
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

/** Evaluate how much a claimed meld improves the hand (count pairs / triplets). */
function meldGain(hand: readonly TileInstance[], ids: readonly number[]): number {
  const counts = handCounts(hand);
  let gain = 0;
  for (const id of ids) {
    const t = hand.find((h) => h.instanceId === id);
    if (!t) continue;
    const tid = tileToId(t.tile);
    const sr = idSuitRank(tid);
    if (!sr) continue;
    if (sr.suit === "honor") gain += 2; // honors only form triplets
    else {
      const n = counts.get(tid) ?? 0;
      gain += n >= 3 ? 3 : n === 2 ? 2 : 1;
    }
  }
  return gain;
}

/**
 * Decide a reaction (or pass) for the given seat during the reaction window.
 * Also handles self-kong during the player's own discard phase (state.phase
 * === "discard" && state.turn === seat).
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

  // --- Self kong (closed / add-on) during own discard phase. ---
  if (state.phase === "discard" && state.turn === seat) {
    const kongs = kongOptions(state, seat, false);
    if (kongs.length > 0) {
      const claimP = difficulty === "hard" ? 0.85 : difficulty === "medium" ? 0.6 : 0.3;
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
    return null; // discard turn — no reaction window
  }

  // --- Reaction window against the latest discard. ---
  if (state.phase !== "reaction" || state.lastDiscardBy === seat || !state.lastDiscard) {
    return null;
  }

  const claimBase: Record<AiDifficulty, number> = { easy: 0.25, medium: 0.55, hard: 0.85 };

  // Kong (open) — strongest claim.
  const openKongs = kongOptions(state, seat, true);
  if (openKongs.length > 0) {
    const opt = openKongs[0]!;
    if (Math.random() < claimBase[difficulty] + 0.1) {
      return {
        action: "reaction",
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: [...opt.handTileIds],
        pengMeldId: opt.pengMeldId,
      };
    }
  }

  // Peng — good when it creates a triplet.
  const peng = pengOptions(state, seat);
  if (peng) {
    const gain = meldGain(hand, peng.handTileIds);
    const p = difficulty === "easy" ? 0.2 : difficulty === "medium" ? 0.45 + gain * 0.1 : 0.65 + gain * 0.08;
    if (Math.random() < Math.min(0.95, p)) {
      return { action: "reaction", kind: "peng" };
    }
  }

  // Chi — only by 上家; medium/hard take it when the run is strong.
  const chis = chiOptions(state, seat, state.lastDiscard);
  if (chis && chis.length > 0) {
    const opt = chis[0]!;
    const gain = meldGain(hand, [opt.handTiles[0]!.instanceId, opt.handTiles[1]!.instanceId]);
    const p = difficulty === "easy" ? 0.15 : difficulty === "medium" ? 0.35 + gain * 0.08 : 0.5 + gain * 0.06;
    if (Math.random() < Math.min(0.9, p)) {
      return {
        action: "reaction",
        kind: "chi",
        handTileIds: [opt.handTiles[0]!.instanceId, opt.handTiles[1]!.instanceId],
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
