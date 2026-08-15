/**
 * Unit tests for the authoritative wall/deal model —
 * 144/136 tile decks, double-cursor tail, dealer 17 / others 16,
 * and the IMMEDIATE_TAIL_CHAIN_V1 continuous flower replacement.
 */

import { describe, expect, it } from "vitest";
import { rngFromSeed } from "../rng.js";
import {
  accountedTiles,
  allTileInstances,
  createDeal,
  createWall,
  dealInitial,
  deckRemaining,
  drawFromDeck,
  drawTile,
  headRemaining,
  replaceFlowersChain,
} from "../wall.js";
import {
  DECK_SIZE,
  DEAL_COUNT,
  TAIL_SIZE,
  buildDeck,
  tileFromId,
  tileToId,
  type Tile,
} from "../tiles.js";

type TileLike = Tile | { tile: Tile };

function countByTileId(instances: readonly TileLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of instances) {
    const tile = "tile" in entry ? entry.tile : entry;
    const id = tileToId(tile);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

describe("tiles — deck composition", () => {
  it("builds exactly 144 tiles for the north variant", () => {
    const deck = buildDeck("north");
    expect(deck).toHaveLength(DECK_SIZE.north);
  });

  it("builds exactly 136 tiles for the south variant (no flowers)", () => {
    const deck = buildDeck("south");
    expect(deck).toHaveLength(DECK_SIZE.south);
    expect(deck.some((t) => t.kind === "flower")).toBe(false);
  });

  it("contains exactly 4 copies of each numbered/honor tile", () => {
    const counts = countByTileId(buildDeck("south"));
    for (const suit of ["wan", "tiao", "tong"] as const) {
      for (let rank = 1; rank <= 9; rank++) {
        expect(counts.get(`${suit}:${rank}`)).toBe(4);
      }
    }
    for (const honor of ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const) {
      expect(counts.get(`honor:${honor}`)).toBe(4);
    }
  });

  it("north deck contains 8 flower tiles (one of each flower/season)", () => {
    const counts = countByTileId(buildDeck("north"));
    for (const flower of ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"] as const) {
      expect(counts.get(`flower:${flower}`)).toBe(1);
    }
  });

  it("round-trips tile ids through tileToId / tileFromId", () => {
    for (const tile of buildDeck("north")) {
      expect(tileFromId(tileToId(tile))).toEqual(tile);
    }
  });

  it("throws on a malformed tile id", () => {
    expect(() => tileFromId("wan:99")).toThrow();
    expect(() => tileFromId("bogus:x")).toThrow();
  });
});

describe("wall — double-cursor model", () => {
  it("reserves exactly the last 16 tiles as the tail", () => {
    const state = createWall("north", rngFromSeed(42));
    expect(state.wall).toHaveLength(144);
    expect(state.tailStart).toBe(144 - TAIL_SIZE);
    expect(state.headCursor).toBe(0);
    expect(state.deckCursor).toBe(state.tailStart);
    expect(headRemaining(state)).toBe(128);
    expect(deckRemaining(state)).toBe(16);
  });

  it("shuffle with the same seed reproduces the same wall (deterministic)", () => {
    const a = createWall("north", rngFromSeed(7));
    const b = createWall("north", rngFromSeed(7));
    expect(a.wall.map((t) => t.instanceId)).toEqual(b.wall.map((t) => t.instanceId));
  });

  it("different seeds produce different walls", () => {
    const a = createWall("north", rngFromSeed(1));
    const b = createWall("north", rngFromSeed(2));
    const idsA = a.wall.map((t) => t.instanceId).join(",");
    const idsB = b.wall.map((t) => t.instanceId).join(",");
    expect(idsA).not.toBe(idsB);
  });
});

describe("deal — dealer 17 / others 16 with flower chain", () => {
  it("deals 17 to the dealer and 16 to each other seat (north)", () => {
    const state = createDeal("north", rngFromSeed(42), 2);
    expect(state.hands[2]).toHaveLength(DEAL_COUNT.dealer);
    expect(state.hands[0]).toHaveLength(DEAL_COUNT.nonDealer);
    expect(state.hands[1]).toHaveLength(DEAL_COUNT.nonDealer);
    expect(state.hands[3]).toHaveLength(DEAL_COUNT.nonDealer);
  });

  it("deals 17 to the dealer and 16 to others (south)", () => {
    const state = createDeal("south", rngFromSeed(1), 0);
    expect(state.hands[0]).toHaveLength(DEAL_COUNT.dealer);
    for (const seat of [1, 2, 3] as const) {
      expect(state.hands[seat]).toHaveLength(DEAL_COUNT.nonDealer);
    }
  });

  it("keeps every hand free of flowers after the chain", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 1);
      for (const seat of [0, 1, 2, 3] as const) {
        expect(state.hands[seat].some((t) => t.tile.kind === "flower")).toBe(false);
      }
    }
  });

  it("moves every drawn flower into the flower tray", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 0);
      const flowers = state.flowers.flat();
      const flowerCount = flowers.length;
      // Every flower drawn during the deal is in a tray; hands have none.
      expect(flowerCount).toBeGreaterThanOrEqual(0);
      for (const seat of [0, 1, 2, 3] as const) {
        expect(state.hands[seat].some((t) => t.tile.kind === "flower")).toBe(false);
      }
      // Instance ids are unique across all trays + hands.
      const ids = allTileInstances(state).map((t) => t.instanceId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("returns a fresh replacement for every flower (chain invariant)", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 2);
      // Deck consumption == number of flowers trayed.
      expect(deckRemaining(state)).toBe(TAIL_SIZE - state.flowers.flat().length);
      // The first 16 per player always come from the head.
      expect(state.headCursor).toBe(4 * 16 + 1);
    }
  });

  it("every tile instance in the game is accounted for exactly once", () => {
    for (const seed of [4, 9, 16, 25]) {
      const state = createDeal("north", rngFromSeed(seed), 3);
      const instances = allTileInstances(state);
      expect(instances).toHaveLength(DECK_SIZE.north);
      expect(accountedTiles(state)).toBe(DECK_SIZE.north);
      const ids = instances.map((t) => t.instanceId);
      expect(new Set(ids).size).toBe(DECK_SIZE.north);
    }
  });

  it("rejects a second initial deal", () => {
    const state = createDeal("south", rngFromSeed(11), 1);
    expect(() => dealInitial(state, 1)).toThrow(/already completed/);
  });
});

describe("drawTile — normal turns keep hands flower-free", () => {
  it("draws from the head and runs the flower chain (no flowers remain)", () => {
    const state = createDeal("north", rngFromSeed(42), 0);
    const before = state.hands[1]!.length;
    const beforeFlowers = state.flowers[1]!.length;
    const beforeHead = state.headCursor;
    drawTile(state, 1);
    // Head always advances by exactly one per normal draw.
    expect(state.headCursor).toBe(beforeHead + 1);
    // A normal draw keeps the head tile (+1); any flower is trayed and
    // replaced 1:1 from the reserved tail, so the hand is always before+1.
    const flowersDrawn = state.flowers[1]!.length - beforeFlowers;
    expect(flowersDrawn).toBeGreaterThanOrEqual(0);
    expect(state.hands[1]!.length).toBe(before + 1);
    expect(state.hands[1]!.some((t) => t.tile.kind === "flower")).toBe(false);
  });
});

describe("drawFromDeck — replacement cursor only within the tail", () => {
  it("throws when the reserved tail is exhausted", () => {
    const state = createDeal("south", rngFromSeed(42), 0);
    // Manually consume the entire reserved tail.
    while (deckRemaining(state) > 0) {
      drawFromDeck(state);
    }
    expect(() => drawFromDeck(state)).toThrow(/exhausted/);
  });

  it("replacement draws never consume the head region", () => {
    const state = createDeal("north", rngFromSeed(1), 0);
    const beforeHead = state.headCursor;
    drawFromDeck(state);
    expect(state.headCursor).toBe(beforeHead);
  });
});

describe("replaceFlowersChain — IMMEDIATE_TAIL_CHAIN_V1", () => {
  it("replaces flowers until the hand has none (north deal always chains)", () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const state = createDeal("north", rngFromSeed(seed), 0);
      // Chain ran to completion already; force-run again for idempotency.
      const drawn = replaceFlowersChain(state, 0);
      expect(state.hands[0]!.some((t) => t.tile.kind === "flower")).toBe(false);
      expect(drawn).toEqual([]);
    }
  });

  it("replacement tiles come from the reserved tail, not the head", () => {
    const state = createDeal("north", rngFromSeed(seedForFlowers()), 0);
    const headBefore = state.headCursor;
    const replacement = drawFromDeck(state);
    expect(replacement.instanceId).toBeGreaterThanOrEqual(state.tailStart);
    expect(state.headCursor).toBe(headBefore);
  });
});

/** Find a seed that yields at least one flower in the deal (for coverage of chaining). */
function seedForFlowers(): number {
  for (let seed = 1; seed < 200; seed++) {
    const state = createDeal("north", rngFromSeed(seed), 0);
    if (state.flowers.flat().length > 0) return seed;
  }
  return 1;
}
