/**
 * Peng (碰牌) unit tests — server-authoritative.
 *
 * 碰: 兩張相同手牌 + 棄牌 = 刻子, 不摸牌轉入出牌階段. Any non-discarder seat
 * may peng (unlike chi which is restricted to the 上家).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard } from "../game.js";
import { pengOptions, performPeng } from "../peng.js";
import type { TileInstance } from "../tiles.js";
import type { GameState } from "../types.js";
import { rngFromSeed } from "../rng.js";

function setup(seat: number, lastDiscardBy: number, discard: TileInstance, hand: TileInstance[]): GameState {
  const state = createGameState("south", rngFromSeed(1), 0);
  // Clear the dealt hands and set our own.
  state.wall.hands = [[], [], [], []];
  state.wall.hands[seat] = hand;
  state.lastDiscard = discard;
  state.lastDiscardBy = lastDiscardBy;
  state.discards = [discard];
  state.turn = seat;
  state.phase = "reaction";
  return state;
}

describe("pengOptions — eligibility", () => {
  beforeEach(() => resetIds());

  it("returns an option when the player holds two identical tiles", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, discard, hand);
    const opt = pengOptions(state, 2);
    expect(opt).not.toBeNull();
    expect(opt!.handTileIds).toHaveLength(2);
  });

  it("returns null when the player has fewer than two identical tiles", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:6", "tong:9");
    const state = setup(2, 0, discard, hand);
    expect(pengOptions(state, 2)).toBeNull();
  });

  it("returns null when there is no discard to peng", () => {
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    expect(pengOptions(state, 2)).toBeNull();
  });

  it("returns null when the seat is the discarder itself", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(0, 0, discard, hand);
    expect(pengOptions(state, 0)).toBeNull();
  });
});

describe("performPeng — state transitions", () => {
  beforeEach(() => resetIds());

  it("removes the two hand tiles, claims the discard, and moves to discard phase", () => {
    const discard = tile("wan:5");
    const hand = tiles(
      "wan:5", "wan:5",
      "tong:1", "tong:2", "tong:3", "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:8", "tong:9", "wan:1", "wan:2", "wan:3", "wan:7", "wan:8",
    );
    const state = setup(1, 0, discard, hand);
    const opt = pengOptions(state, 1)!;
    const handCountBefore = hand.length;
    const result = performPeng(state, 1, opt);

    expect(result.meldId).toBeGreaterThan(0);
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    expect(state.melds[1]!.length).toBe(1);
    expect(state.melds[1]![0]!.kind).toBe("peng");
    expect(state.melds[1]![0]!.tiles).toHaveLength(3);
    // 不摸牌: no new tile added to the hand.
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    // 轉入出牌階段.
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(1);
    // The claimed discard is gone from the pool.
    expect(state.discards).not.toContain(discard);
  });

  it("throws when the hand tiles are not in the claimant's hand", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:5", "wan:6", "tong:9");
    const state = setup(2, 0, discard, hand);
    const foreign = tiles("wan:9");
    const fakeOption = {
      handTileIds: [foreign[0]!.instanceId, foreign[0]!.instanceId] as [number, number],
    };
    expect(() => performPeng(state, 2, fakeOption)).toThrow(/claimant/);
  });

  it("throws when there is no discard to peng", () => {
    const hand = tiles("wan:5", "wan:5", "tong:9");
    const state = setup(2, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    const opt = { handTileIds: [1000, 1001] as [number, number] };
    expect(() => performPeng(state, 2, opt)).toThrow(/No discard/);
  });
});

describe("performDiscard → reaction phase → peng integration", () => {
  beforeEach(() => resetIds());

  it("a normal discard opens a peng window for any non-discarder seat", () => {
    const state = createGameState("south", rngFromSeed(3), 0);
    // Force seat 2 to hold a matching pair for the first discarded tile.
    const discardInst = state.wall.hands[0]![0]!;
    const seat2Hand = state.wall.hands[2] as TileInstance[];
    seat2Hand.push(
      { tile: discardInst.tile, instanceId: 9000 },
      { tile: discardInst.tile, instanceId: 9001 },
    );
    const discarded = performDiscard(state, 0, discardInst.instanceId);
    expect(state.phase).toBe("reaction");
    // Any seat other than the discarder (0) with the pair can peng.
    const opt = pengOptions(state, 2);
    expect(opt).not.toBeNull();
    expect(discarded.instanceId).toBe(discardInst.instanceId);
  });
});
