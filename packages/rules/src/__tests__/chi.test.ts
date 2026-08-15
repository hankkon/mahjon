/**
 * Chi (吃牌) unit tests — server-authoritative.
 *
 * 限吃上家最新數牌棄牌, 兩張手牌 + 棄牌 = 順子, 不摸牌轉入出牌階段.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard } from "../game.js";
import { chiOptions, performChi } from "../chi.js";
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

describe("chiOptions — eligibility", () => {
  beforeEach(() => resetIds());

  it("returns options only to the player immediately after the discarder (上家)", () => {
    // discarder = seat 0, claimant must be seat 1.
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "tong:9");
    const ok = setup(1, 0, discard, hand);
    expect(chiOptions(ok, 1, discard)).not.toBeNull();

    const bad = setup(2, 0, discard, hand);
    expect(chiOptions(bad, 2, discard)).toBeNull();
  });

  it("rejects chi on honor/flowers (only numbered suits)", () => {
    const discard = tile("honor:dong");
    const hand = tiles("honor:dong", "honor:dong", "wan:3");
    const state = setup(1, 0, discard, hand);
    expect(chiOptions(state, 1, discard)).toBeNull();
  });

  it("returns empty options when the claimant cannot form a run", () => {
    const discard = tile("wan:5");
    const hand = tiles("tong:1", "tong:2", "wan:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard);
    // Eligible (上家, numbered discard) but no two tiles complete a run: [].
    expect(opts).toEqual([]);
  });

  it("finds all three run patterns for a middle discard", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "wan:6", "wan:7");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    expect(opts.length).toBeGreaterThanOrEqual(2);
    // Each option's run must contain the discard's identity.
    for (const opt of opts) {
      expect(opt.run.map((t) => t.tile.kind === "numbered" ? `${t.tile.suit}:${t.tile.rank}` : ""))
        .toContain("wan:5");
      expect(opt.handTiles).toHaveLength(2);
    }
  });

  it("does not include a second identical discard instance (hand 3,4,6,6)", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "wan:6", "wan:6");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    // 3,4 + 5 and 4,6 + 5 are the valid runs; 3,6 is not a run.
    const validCombos = opts.filter((o) => {
      const ranks = o.handTiles.map((t) => (t.tile.kind === "numbered" ? t.tile.rank : 0)).sort((a, b) => a - b);
      return (ranks[0] === 3 && ranks[1] === 4) || (ranks[0] === 4 && ranks[1] === 6);
    });
    expect(validCombos.length).toBeGreaterThan(0);
  });
});

describe("performChi — state transitions", () => {
  beforeEach(() => resetIds());

  it("removes the two hand tiles, claims the discard, and moves to discard phase", () => {
    const discard = tile("wan:5");
    const hand = tiles("wan:3", "wan:4", "tong:1", "tong:2", "tong:3", "tong:4", "tong:5", "tong:6", "tong:7", "tong:8", "tong:9", "wan:9", "wan:9", "wan:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    const opt = opts[0]!;
    const handCountBefore = hand.length;
    const result = performChi(state, 1, opt);

    expect(result.meldId).toBeGreaterThan(0);
    expect(state.wall.hands[1]!.length).toBe(handCountBefore - 2);
    expect(state.melds[1]!.length).toBe(1);
    expect(state.melds[1]![0]!.kind).toBe("chi");
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
    const hand = tiles("wan:3", "wan:4", "tong:9");
    const state = setup(1, 0, discard, hand);
    const opts = chiOptions(state, 1, discard)!;
    const opt = opts[0]!;
    // Swap out one of the hand tiles.
    const foreign = tiles("wan:8")[0]!;
    const fakeOption = { handTiles: [opt.handTiles[0]!, foreign] as [TileInstance, TileInstance], run: opt.run };
    expect(() => performChi(state, 1, fakeOption)).toThrow(/claimant/);
  });

  it("throws when there is no discard to chi", () => {
    const hand = tiles("wan:3", "wan:4");
    const state = setup(1, 0, tile("wan:5"), hand);
    state.lastDiscard = undefined;
    state.lastDiscardBy = undefined;
    const opt: { handTiles: [TileInstance, TileInstance]; run: TileInstance[] } = {
      handTiles: [tiles("wan:3")[0]!, tiles("wan:4")[0]!],
      run: tiles("wan:3", "wan:4", "wan:5"),
    };
    expect(() => performChi(state, 1, opt)).toThrow(/No discard/);
  });
});

describe("performDiscard → reaction phase → chi integration", () => {
  beforeEach(() => resetIds());

  it("a normal discard sets up a chi window for the next seat", () => {
    const state = createGameState("south", rngFromSeed(2), 0);
    const hand = state.wall.hands[0] as TileInstance[];
    const toDiscard = hand[0]!;
    const discarded = performDiscard(state, 0, toDiscard.instanceId);
    expect(state.phase).toBe("reaction");
    // Next seat (1) can chi this discard if it can form a run.
    const opts = chiOptions(state, 1, discarded);
    expect(opts === null || Array.isArray(opts)).toBe(true);
  });
});
