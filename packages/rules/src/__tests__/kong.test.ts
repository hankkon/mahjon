/**
 * Kong (槓牌) unit tests — 明槓/暗槓/加槓/搶槓 + 尾牆補牌 + 連續補花.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, tile, resetIds } from "./helpers.js";
import { createGameState, performDiscard, nextSeat } from "../game.js";
import { kongOptions, performKong, qiangKong } from "../kong.js";
import type { TileInstance } from "../tiles.js";
import type { GameState, Meld } from "../types.js";
import { rngFromSeed } from "../rng.js";
import { deckRemaining } from "../wall.js";
import { detectWin } from "../win.js";

function setup(): GameState {
  const state = createGameState("south", rngFromSeed(1), 0);
  state.wall.hands = [[], [], [], []];
  return state;
}

describe("kongOptions — detection", () => {
  beforeEach(() => resetIds());

  it("detects a closed kong from 4 identical hand tiles", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "wan:5", "tong:9");
    const opts = kongOptions(state, 0, false);
    const closed = opts.find((o) => o.kongType === "closed");
    expect(closed).toBeDefined();
    expect(closed!.handTileIds).toHaveLength(4);
  });

  it("does not create an open kong option unless a discard is claimable", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    const opts = kongOptions(state, 0, false);
    expect(opts.find((o) => o.kongType === "open")).toBeUndefined();
  });

  it("creates an open kong option when a matching discard exists and allowClaim", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    const discard = tile("wan:5");
    state.lastDiscard = discard;
    state.lastDiscardBy = 3;
    state.discards = [discard];
    const opts = kongOptions(state, 0, true);
    const open = opts.find((o) => o.kongType === "open");
    expect(open).toBeDefined();
    expect(open!.handTileIds).toHaveLength(3);
  });

  it("detects an add-on kong from an existing peng meld", () => {
    const state = setup();
    state.wall.hands[0] = tiles("wan:5", "tong:9");
    const claimed = tile("wan:5");
    const handPair = tiles("wan:5", "wan:5");
    const peng: Meld = {
      id: 1,
      kind: "peng",
      tiles: [...handPair, claimed],
      claimed,
    };
    state.melds[0] = [peng];
    const opts = kongOptions(state, 0, false);
    const addon = opts.find((o) => o.kongType === "add-on");
    expect(addon).toBeDefined();
    expect(addon!.pengMeldId).toBe(1);
  });
});

describe("performKong — closed kong", () => {
  beforeEach(() => resetIds());

  it("removes 4 hand tiles, creates the meld, draws a replacement from the deck", () => {
    const state = setup();
    const hand = tiles("wan:5", "wan:5", "wan:5", "wan:5", "tong:9", "tong:9");
    state.wall.hands[0] = hand;
    const deckBefore = deckRemaining(state.wall);
    const closed = kongOptions(state, 0, false).find((o) => o.kongType === "closed")!;
    const result = performKong(state, 0, closed);

    expect(state.wall.hands[0]!.length).toBe(2 + 1); // 2 left + replacement
    expect(state.melds[0]![0]!.kind).toBe("kong");
    expect((state.melds[0]![0]! as { kongType: string }).kongType).toBe("closed");
    expect(result.replacement).toBeDefined();
    expect(deckRemaining(state.wall)).toBe(deckBefore - 1);
    // Moves to discard phase.
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(0);
  });
});

describe("performKong — open kong", () => {
  beforeEach(() => resetIds());

  it("claims the discard + 3 hand tiles and draws a replacement", () => {
    const state = setup();
    const hand = tiles("wan:5", "wan:5", "wan:5", "tong:9");
    state.wall.hands[0] = hand;
    const discard = tile("wan:5");
    state.lastDiscard = discard;
    state.lastDiscardBy = 3;
    state.discards = [discard];
    const open = kongOptions(state, 0, true).find((o) => o.kongType === "open")!;
    const before = hand.length;
    const result = performKong(state, 0, open);

    expect((state.melds[0]![0]! as { kongType: string }).kongType).toBe("open");
    expect(state.melds[0]![0]!.tiles).toHaveLength(4);
    expect(state.discards).not.toContain(discard);
    // 3 removed + 1 replacement = before - 2
    expect(state.wall.hands[0]!.length).toBe(before - 2);
    expect(result.replacement).toBeDefined();
  });
});

describe("performKong — add-on kong", () => {
  beforeEach(() => resetIds());

  it("upgrades a peng meld to a kong meld using the 4th tile", () => {
    const state = setup();
    const claimed = tile("wan:5");
    const handPair = tiles("wan:5", "wan:5");
    state.melds[0] = [{ id: 7, kind: "peng", tiles: [...handPair, claimed], claimed }];
    state.wall.hands[0] = tiles("wan:5", "tong:9");
    const addon = kongOptions(state, 0, false).find((o) => o.kongType === "add-on")!;
    const result = performKong(state, 0, addon);

    const meld = state.melds[0]![0]!;
    expect(meld.kind).toBe("kong");
    expect((meld as { kongType: string }).kongType).toBe("add-on");
    expect(meld.tiles).toHaveLength(4);
    expect(meld.id).toBe(7); // keeps the peng meld id
    expect(result.meldId).toBe(7);
    // 1 hand tile consumed + 1 replacement.
    expect(state.wall.hands[0]!.length).toBe(1 + 1);
  });
});

describe("qiangKong — 搶槓 window", () => {
  beforeEach(() => resetIds());

  it("returns the nearest robber with a winning hand on the added tile", () => {
    const state = setup();
    state.turn = 2; // player 2 is making the add-on kong
    const extra = tile("wan:5");
    const robberHand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    // 16 hand tiles; the robbed wan:5 completes the wan:456 meld →
    // 123 / 456 / 789 / tong123 / tong456 + tong7 pair = 17 → win.
    // P0-1: the robbed tile is passed in explicitly — state.lastDiscard is
    // undefined before performKong runs, so qiangKong must never read it.
    expect(state.lastDiscard).toBeUndefined();
    const robber = qiangKong(
      state,
      [1, 3],
      extra,
      (seat) => (seat === 1 ? robberHand : []),
      (_seat, hand, ex) => detectWin([...hand, ex], []).win,
    );
    // Seat 3 is closer (distance 1) but does not win; seat 1 wins.
    expect(robber).toBe(1);
  });

  it("returns null when no robber can win", () => {
    const state = setup();
    state.turn = 0;
    const extra = tile("wan:5");
    const robber = qiangKong(
      state,
      [1, 2, 3],
      extra,
      () => tiles("tong:1", "tong:2"),
      () => false,
    );
    expect(robber).toBeNull();
  });

  it("P0-1: evaluates each robber against its OWN melds (not robbers[0])", () => {
    const state = setup();
    state.turn = 2; // player 2 is making the add-on kong
    const extra = tile("wan:5");
    // Seat 3 wins ONLY thanks to its own peng meld: 14 tiles (13 + robbed
    // wan:5) + the 3-tile peng = 17 → win.
    const seat3Hand = tiles(
      "wan:4", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    const claimed = tile("wan:1");
    state.melds[3] = [
      { id: 100, kind: "peng", tiles: [...tiles("wan:1", "wan:1"), claimed], claimed },
    ];
    // Seat 1 has no melds and cannot win on wan:5.
    const seat1Hand = tiles(
      "tong:1", "tong:2", "tong:3", "tong:4", "tong:5",
      "tong:6", "tong:7", "tong:8", "tong:9", "wan:9",
    );
    const seen: number[] = [];
    // robbers[0] = seat 1 — the old buggy code looked up seat 1's (empty)
    // melds when evaluating seat 3 too, wrongly concluding nobody could win.
    const robber = qiangKong(
      state,
      [1, 3],
      extra,
      (seat) => (seat === 3 ? seat3Hand : seat1Hand),
      (seat, hand, ex) => {
        seen.push(seat);
        const melds = (state.melds[seat] ?? []) as Meld[];
        return detectWin([...hand, ex], melds).win;
      },
    );
    expect(robber).toBe(3);
    // Nearest-first from turn=2: seat 3 (distance 1) wins using its OWN peng
    // meld, so the loop short-circuits and seat 1 (distance 3) is never reached.
    // (Under the old bug it would look up seat 1's empty melds → no win → null.)
    expect(seen).toEqual([3]);
  });
});

describe("integration — kong replacement keeps flower chain consistent", () => {
  beforeEach(() => resetIds());

  it("a kong replacement never leaves a flower in the hand", () => {
    const state = createGameState("north", rngFromSeed(3), 0);
    // Force 4 identical tiles into seat 0's hand.
    const hand = state.wall.hands[0] as TileInstance[];
    // Replace the first 4 hand tiles with 4 identical numbered tiles.
    const four = tiles("wan:5", "wan:5", "wan:5", "wan:5");
    hand.splice(0, 4, ...four);
    const closed = kongOptions(state, 0, false).find((o) => o.kongType === "closed")!;
    performKong(state, 0, closed);
    expect(state.wall.hands[0]!.some((t) => t.tile.kind === "flower")).toBe(false);
  });
});
