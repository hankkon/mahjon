/**
 * Wait analysis (聽牌分析) unit tests.
 *
 * Mirrors the authoritative reference implementation: 邊張/坎張/單吊 only apply
 * on a SINGLE wait (單聽) where the winning tile's role is exclusive.
 */

import { describe, expect, it } from "vitest";
import { tiles } from "./helpers.js";
import { analyzeWait, enumerateGroupings, hasAllChowsStructure, hasExclusiveWaitRole } from "../wait.js";
import type { TileInstance } from "../tiles.js";

/** Find the instance whose identity id matches. */
function byId(hand: readonly TileInstance[], faceId: string): TileInstance {
  const inst = hand.find((t) => {
    const id =
      t.tile.kind === "flower"
        ? `flower:${t.tile.flower}`
        : t.tile.kind === "honor"
          ? `honor:${t.tile.honor}`
          : `${t.tile.suit}:${t.tile.rank}`;
    return id === faceId;
  });
  if (!inst) throw new Error(`Tile ${faceId} not found`);
  return inst;
}

/** Find the LAST instance whose identity id matches (winning copy placed last). */
function byIdLast(hand: readonly TileInstance[], faceId: string): TileInstance {
  for (let i = hand.length - 1; i >= 0; i--) {
    const t = hand[i]!.tile;
    const id =
      t.kind === "flower" ? `flower:${t.flower}` : t.kind === "honor" ? `honor:${t.honor}` : `${t.suit}:${t.rank}`;
    if (id === faceId) return hand[i]!;
  }
  throw new Error(`Tile ${faceId} not found`);
}

describe("enumerateGroupings", () => {
  it("decomposes 5 runs + pair (17 tiles) into exactly the expected shape", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    const groupings = enumerateGroupings(hand);
    expect(groupings.length).toBeGreaterThan(0);
    expect(groupings.some((g) => g.groups.length === 5 && g.pair?.length === 2)).toBe(true);
  });

  it("returns no groupings for a seven-pairs (八對) hand with no run structure", () => {
    // 7 honor pairs (cannot form runs/triplets) + one suited triplet:
    // the hand can only win as 八對子, never as 5 melds + pair.
    const hand = tiles(
      "honor:dong", "honor:dong", "honor:nan", "honor:nan",
      "honor:xi", "honor:xi", "honor:bei", "honor:bei",
      "honor:zhong", "honor:zhong", "honor:fa", "honor:fa",
      "honor:bai", "honor:bai",
      "tong:9", "tong:9", "tong:9",
    );
    expect(enumerateGroupings(hand)).toEqual([]);
  });
});

describe("analyzeWait — 單聽 exclusive roles", () => {
  it("單吊: winning tile is the pair, single wait", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "wan:5", "wan:5",
    );
    const winning = byIdLast(hand, "wan:5"); // the pair copy completing the pair
    const a = analyzeWait(hand, [], winning);
    expect(a).not.toBeNull();
    expect(a!.singleWait).toBe(true);
    expect(a!.waitingFaceIds).toEqual(["wan:5"]);
    expect([...a!.winningRoles]).toEqual(["SINGLE"]);
    expect(hasExclusiveWaitRole(a!, "SINGLE")).toBe(true);
    expect(hasExclusiveWaitRole(a!, "EDGE")).toBe(false);
    expect(hasExclusiveWaitRole(a!, "CLOSED")).toBe(false);
  });

  it("邊張: winning 3 completes the 1-2-3 edge, single wait", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:9", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
    );
    const winning = byId(hand, "tong:3");
    const a = analyzeWait(hand, [], winning);
    expect(a).not.toBeNull();
    expect(a!.singleWait).toBe(true);
    expect(a!.waitingFaceIds).toEqual(["tong:3"]);
    expect([...a!.winningRoles]).toEqual(["EDGE"]);
    expect(hasExclusiveWaitRole(a!, "EDGE")).toBe(true);
  });

  it("坎張: winning 3 completes the 2-4 closed wait, single wait", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:9", "wan:9",
      "tong:2", "tong:3", "tong:4",
      "tong:4", "tong:5", "tong:6",
    );
    const winning = byId(hand, "tong:3");
    const a = analyzeWait(hand, [], winning);
    expect(a).not.toBeNull();
    expect(a!.singleWait).toBe(true);
    expect(a!.waitingFaceIds).toEqual(["tong:3"]);
    expect([...a!.winningRoles]).toEqual(["CLOSED"]);
    expect(hasExclusiveWaitRole(a!, "CLOSED")).toBe(true);
  });

  it("multi-wait (三面聽) is NOT a single wait — no exclusive role", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    const winning = byId(hand, "tong:7");
    const a = analyzeWait(hand, [], winning);
    expect(a).not.toBeNull();
    expect(a!.singleWait).toBe(false);
    expect(a!.waitingFaceIds).toContain("tong:7");
    expect(hasExclusiveWaitRole(a!, "SINGLE")).toBe(false);
  });

  it("七對子 (八對) has no standard-shape wait analysis", () => {
    const hand = tiles(
      "honor:dong", "honor:dong", "honor:nan", "honor:nan",
      "honor:xi", "honor:xi", "honor:bei", "honor:bei",
      "honor:zhong", "honor:zhong", "honor:fa", "honor:fa",
      "honor:bai", "honor:bai",
      "tong:9", "tong:9", "tong:9",
    );
    const winning = byId(hand, "tong:9");
    expect(analyzeWait(hand, [], winning)).toBeNull();
  });

  it("returns null when the winning tile is not part of the hand", () => {
    const hand = tiles("wan:1", "wan:2", "wan:3");
    const outsider = tiles("wan:9")[0]!;
    expect(analyzeWait(hand, [], outsider)).toBeNull();
  });
});

describe("hasAllChowsStructure — 平胡結構", () => {
  it("true for five runs + pair", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    expect(hasAllChowsStructure(hand, [])).toBe(true);
  });

  it("false when a triplet exists", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    expect(hasAllChowsStructure(hand, [])).toBe(false);
  });

  it("false when an open peng exists", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:7", "tong:7",
    );
    const melds = [{ id: 1, kind: "peng" as const, tiles: tiles("honor:dong", "honor:dong", "honor:dong"), claimed: tiles("honor:dong")[0]! }];
    expect(hasAllChowsStructure(hand, melds)).toBe(false);
  });
});
