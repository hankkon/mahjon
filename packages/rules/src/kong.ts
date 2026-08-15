/**
 * Kong (槓牌) — server-authoritative Domain logic.
 *
 * Supports:
 *  - 明槓 (open kong): claim a discard + 3 identical hand tiles.
 *  - 暗槓 (closed kong): 4 identical tiles from the hand (concealed).
 *  - 加槓 (add-on kong): upgrade an existing 碰 (peng) meld with a 4th tile.
 *  - 搶槓 (qiang kong): win window when a player adds to a peng — the add-on
 *    kong can be robbed by a player holding the winning tile.
 *
 * Every kong triggers 尾牆補牌 (replacement draw from the deck cursor) and the
 * continuous flower replacement (IMMEDIATE_TAIL_CHAIN_V1) via the wall.
 */

import type { GameState, KongType, Meld, PengMeld } from "./types.js";
import type { TileInstance } from "./tiles.js";
import type { Seat } from "./wall.js";
import { nextMeldId, removeByInstanceId, removeFromRiver, seatDistance } from "./game.js";
import { drawFromDeck, replaceFlowersChain } from "./wall.js";

export interface KongOption {
  kongType: KongType;
  /** Hand tiles for open (3) / closed (4) kong, or empty for add-on. */
  handTileIds: readonly number[];
  /** Peng meld id to upgrade (add-on kong only). */
  pengMeldId?: number;
}

/**
 * Enumerate the kong options available to a player right now.
 * `allowClaim` gates open-kong claiming a fresh discard.
 */
export function kongOptions(state: GameState, seat: number, allowClaim: boolean): KongOption[] {
  const hand = state.wall.hands[seat] as TileInstance[];
  const options: KongOption[] = [];

  // --- Closed kong: 4 identical tiles in hand. ---
  const byId = new Map<string, number[]>();
  for (const t of hand) {
    const id = tileKey(t);
    const list = byId.get(id) ?? [];
    list.push(t.instanceId);
    byId.set(id, list);
  }
  for (const ids of byId.values()) {
    if (ids.length === 4) {
      options.push({ kongType: "closed", handTileIds: ids });
    }
  }

  // --- Add-on kong: upgrade a peng meld with the 4th tile from hand. ---
  const melds = state.melds[seat] as Meld[];
  for (const meld of melds) {
    if (meld.kind !== "peng") continue;
    const peng = meld as PengMeld;
    const claimedId = tileKey(peng.claimed);
    const handIds = byId.get(claimedId);
    if (handIds && handIds.length >= 1) {
      options.push({ kongType: "add-on", handTileIds: [handIds[0]!], pengMeldId: peng.id });
    }
  }

  // --- Open kong: claim the last discard with 3 matching hand tiles. ---
  if (allowClaim && state.lastDiscard) {
    const discard = state.lastDiscard;
    const discardId = tileKey(discard);
    const handIds = byId.get(discardId);
    if (handIds && handIds.length === 3) {
      options.push({ kongType: "open", handTileIds: handIds });
    }
  }

  return options;
}

/** Stable key for grouping by tile identity. */
function tileKey(t: TileInstance): string {
  return t.tile.kind === "numbered"
    ? `${t.tile.suit}:${t.tile.rank}`
    : t.tile.kind === "honor"
      ? `honor:${t.tile.honor}`
      : `flower:${t.tile.flower}`;
}

export interface KongResult {
  meldId: number;
  /** Replacement tile drawn from the deck cursor after the kong. */
  replacement?: TileInstance;
  kongType: KongType;
}

/**
 * Perform a kong and take the replacement draw (尾牆補牌) + flower chain.
 * - open kong: claim the discard, remove 3 hand tiles, meld 4.
 * - closed kong: remove 4 hand tiles, meld 4.
 * - add-on kong: remove 1 hand tile, upgrade the peng meld to a kong meld.
 */
export function performKong(
  state: GameState,
  seat: number,
  option: KongOption,
): KongResult {
  const hand = state.wall.hands[seat] as TileInstance[];
  let meldId = nextMeldId(state);

  if (option.kongType === "open") {
    const discard = state.lastDiscard;
    if (!discard) throw new Error("No discard available for open kong");
    const discardIdx = state.discards.indexOf(discard);
    if (discardIdx === -1) throw new Error("Claimed discard not in pool");
    if (option.handTileIds.length !== 3) {
      throw new Error("Open kong requires exactly 3 hand tiles");
    }
    const handTiles = option.handTileIds.map((id) => findInHand(state, seat, id));
    state.discards.splice(discardIdx, 1);
    removeFromRiver(state, discard);
    for (const id of option.handTileIds) removeByInstanceId(hand, id);
    (state.melds[seat] as Meld[]).push({
      id: meldId,
      kind: "kong",
      kongType: "open",
      tiles: [...handTiles, discard],
      claimed: discard,
    });
  } else if (option.kongType === "closed") {
    if (option.handTileIds.length !== 4) {
      throw new Error("Closed kong requires exactly 4 hand tiles");
    }
    const tiles = option.handTileIds.map((id) => findInHand(state, seat, id));
    for (const id of option.handTileIds) removeByInstanceId(hand, id);
    (state.melds[seat] as Meld[]).push({
      id: meldId,
      kind: "kong",
      kongType: "closed",
      tiles,
    });
  } else {
    // add-on
    const pengId = option.pengMeldId;
    if (pengId === undefined) throw new Error("Add-on kong requires a peng meld id");
    const melds = state.melds[seat] as Meld[];
    const pengIdx = melds.findIndex((m) => m.id === pengId && m.kind === "peng");
    if (pengIdx === -1) throw new Error(`Peng meld ${pengId} not found`);
    const peng = melds[pengIdx] as PengMeld;
    const extraId = option.handTileIds[0];
    if (extraId === undefined) throw new Error("Add-on kong requires the 4th tile");
    const extra = findInHand(state, seat, extraId);
    removeByInstanceId(hand, extraId);
    const kongMeld: Meld = {
      id: peng.id,
      kind: "kong",
      kongType: "add-on",
      tiles: [...peng.tiles, extra],
      claimed: peng.claimed,
      fromPengId: pengId,
    };
    melds[pengIdx] = kongMeld;
    meldId = peng.id;
  }

  // 尾牆補牌 + 連續補花.
  const replacement = drawFromDeck(state.wall);
  (state.wall.hands[seat] as TileInstance[]).push(replacement);
  replaceFlowersChain(state.wall, seat as Seat);

  state.turn = seat;
  state.phase = "discard";
  state.lastDiscard = undefined;
  state.lastDiscardBy = undefined;
  return { meldId, replacement, kongType: option.kongType };
}

function findInHand(state: GameState, seat: number, instanceId: number): TileInstance {
  const hand = state.wall.hands[seat] as TileInstance[];
  const found = hand.find((t) => t.instanceId === instanceId);
  if (!found) throw new Error(`Tile ${instanceId} not in hand ${seat}`);
  return found;
}

/**
 * 搶槓 (qiang kong) — a player may win on the tile being added in an add-on
 * kong. Returns the seat of a valid robber (nearest by turn order), or null.
 *
 * CRITICAL (P0-1): the robbed tile must be passed in explicitly by the caller
 * (the kongger's add-on tile instance from `performKong`'s option). It must
 * NOT be derived from `state.lastDiscard` — at the moment qiang-kong is
 * evaluated the add-on kong has NOT been performed yet, so `lastDiscard` is
 * `undefined`. The win callback receives the actual robber's `seat` so the
 * caller can look up the correct per-seat melds (a fixed seat would silently
 * check the wrong player's open melds).
 */
export function qiangKong(
  state: GameState,
  robbers: readonly number[],
  extraTile: TileInstance,
  handTilesOf: (seat: number) => readonly TileInstance[],
  isWin: (seat: number, hand: readonly TileInstance[], extra: TileInstance) => boolean,
): number | null {
  if (robbers.length === 0) return null;
  const turnSeat = state.turn;
  const sorted = [...robbers].sort((a, b) => seatDistance(turnSeat, a) - seatDistance(turnSeat, b));
  for (const seat of sorted) {
    if (isWin(seat, handTilesOf(seat), extraTile)) return seat;
  }
  return null;
}
