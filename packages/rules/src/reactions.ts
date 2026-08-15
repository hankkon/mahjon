/**
 * Reaction priority resolution — server-authoritative.
 *
 * When multiple players can react to a discard, priority is strict:
 *   自動胡牌 (win) > 槓/碰 (kong/peng) > 吃 (chi).
 * Within the same category, the player closest to the discarder in turn order
 * wins (counter-clockwise nearest first). Ties in peng/kong go to the
 * nearest; the dealer wins ties when all else is equal (連莊 handled upstream).
 */

import type { GameState, Reaction } from "./types.js";
import { seatDistance } from "./game.js";

export type ReactionPriority = "win" | "kong" | "peng" | "chi";

const PRIORITY_ORDER: Record<ReactionPriority, number> = {
  win: 0,
  kong: 1,
  peng: 2,
  chi: 3,
};

/**
 * Resolve a set of candidate reactions into the single winning reaction.
 * Returns null when no reaction is possible (turn passes to the next player).
 */
export function resolveReactions(state: GameState, reactions: readonly Reaction[]): Reaction | null {
  if (reactions.length === 0) return null;

  const lastDiscardBy = state.lastDiscardBy;
  const turnSeat = lastDiscardBy !== undefined ? lastDiscardBy : state.turn;

  // Sort by priority first, then by seat distance from the discarder.
  const sorted = [...reactions].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.kind as ReactionPriority];
    const pb = PRIORITY_ORDER[b.kind as ReactionPriority];
    if (pa !== pb) return pa - pb;
    return seatDistance(turnSeat, a.seat) - seatDistance(turnSeat, b.seat);
  });

  return sorted[0] ?? null;
}

/**
 * Filter the reactions down to a single kind, used to build the reaction
 * window presented to the players. This mirrors `resolveReactions` but keeps
 * all equal-priority candidates so the UI can display them.
 */
export function reactionWindow(
  state: GameState,
  reactions: readonly Reaction[],
): Reaction[] {
  if (reactions.length === 0) return [];
  const resolved = resolveReactions(state, reactions);
  if (!resolved) return [];
  return reactions.filter((r) => r.kind === resolved.kind);
}
