/**
 * Game-loop helpers — pure functions driving the authoritative state machine.
 *
 * The server never asks clients whether a hand is legal: 合法可胡即自動胡牌.
 * On every discard the server checks all other seats for a win (auto-win), and
 * only chi/peng/kong are offered back to eligible clients as a reaction window.
 */

import type {
  ChiOption,
  GameState,
  KongOption,
  ReactionKind,
  WinReaction,
} from "@taiwan-mahjong/rules";
import { chiOptions, detectWin, kongOptions, pengOptions, SEATS } from "@taiwan-mahjong/rules";

/** Auto-win candidates on the latest discard (every seat but the discarder). */
export function collectWinReactions(state: GameState): WinReaction[] {
  const out: WinReaction[] = [];
  const discard = state.lastDiscard;
  const discardBy = state.lastDiscardBy;
  if (!discard || discardBy === undefined) return out;
  for (const seat of SEATS) {
    if (seat === discardBy) continue;
    const hand = state.wall.hands[seat]!;
    if (detectWin([...hand, discard], state.melds[seat]).win) {
      out.push({ kind: "win", seat, selfDraw: false });
    }
  }
  return out;
}

/**
 * Non-win reactions available per seat on the latest discard.
 * Returns Map<seat, Set<"kong" | "peng" | "chi">> — the reaction window.
 */
export function collectPendingKinds(state: GameState): Map<number, Set<ReactionKind>> {
  const out = new Map<number, Set<ReactionKind>>();
  const discard = state.lastDiscard;
  const discardBy = state.lastDiscardBy;
  if (!discard || discardBy === undefined) return out;
  for (const seat of SEATS) {
    if (seat === discardBy) continue;
    const kinds = new Set<ReactionKind>();
    if (kongOptions(state, seat, true).length > 0) kinds.add("kong");
    if (pengOptions(state, seat) !== null) kinds.add("peng");
    const chis = chiOptions(state, seat, discard);
    if (chis !== null && chis.length > 0) kinds.add("chi");
    if (kinds.size > 0) out.set(seat, kinds);
  }
  return out;
}

/** Locate the exact chi option matching the client's two hand-tile ids. */
export function findChiOption(
  state: GameState,
  seat: number,
  handTileIds: [number, number],
): ChiOption | null {
  const discard = state.lastDiscard;
  if (!discard) return null;
  const chis = chiOptions(state, seat, discard);
  if (!chis) return null;
  const want = new Set<number>(handTileIds);
  return (
    chis.find(
      (o) =>
        o.handTiles.length === 2 &&
        want.has(o.handTiles[0]!.instanceId) &&
        want.has(o.handTiles[1]!.instanceId),
    ) ?? null
  );
}

/** Locate the exact kong option matching the client's payload. */
export function findKongOption(
  state: GameState,
  seat: number,
  allowClaim: boolean,
  kongType: string,
  handTileIds?: number[],
  pengMeldId?: number,
): KongOption | null {
  const opts = kongOptions(state, seat, allowClaim);
  return (
    opts.find((o) => {
      if (o.kongType !== kongType) return false;
      if (pengMeldId !== undefined && o.pengMeldId !== pengMeldId) return false;
      if (handTileIds && handTileIds.length > 0) {
        const a = new Set<number>(handTileIds);
        const b = new Set<number>(o.handTileIds);
        if (a.size !== b.size) return false;
        for (const id of a) if (!b.has(id)) return false;
      }
      return true;
    }) ?? null
  );
}
