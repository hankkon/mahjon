/**
 * Wall-opening (骰子定門) unit tests — TAIWAN_WALL_OPENING_V1.
 *
 * The dice total determines the opening seat and the break point; the shuffled
 * wall is then traversed in ascending circular stack order from the break, and
 * the last 16 tiles of that resolved order remain the reserved tail.
 */

import { describe, expect, it } from "vitest";
import { rngFromSeed } from "../rng.js";
import { applyWallOpening, createWall } from "../wall.js";
import { TAIL_SIZE } from "../tiles.js";

describe("wall opening — TAIWAN_WALL_OPENING_V1", () => {
  it("north (144 tiles, 72 stacks, 18/side): dice total 8 opens at seat 3", () => {
    const state = createWall("north", rngFromSeed(42));
    const original = [...state.wall]; // instance order before opening
    const opening = applyWallOpening(state, 0, [2, 3, 3]); // total 8
    expect(opening.openingSeatOffset).toBe(3);
    expect(opening.openingSeat).toBe(3);
    expect(opening.stacksPerSide).toBe(18);
    expect(opening.totalStacks).toBe(72);
    expect(opening.normalDrawStartStackIndex).toBe((3 * 18 + 8) % 72); // 62
    expect(opening.breakAfterStackIndex).toBe(61);
    // The head now starts at stack 62 (original indices 124, 125).
    expect(state.wall[0]!.instanceId).toBe(original[124]!.instanceId);
    expect(state.wall[1]!.instanceId).toBe(original[125]!.instanceId);
    // The tail (last 16) are the final 8 stacks of the resolved order.
    expect(state.tailStart).toBe(original.length - TAIL_SIZE);
    expect(state.headCursor).toBe(0);
    expect(state.deckCursor).toBe(state.tailStart);
  });

  it("south (136 tiles, 68 stacks, 17/side): dice total 9 keeps the dealer as opener", () => {
    const state = createWall("south", rngFromSeed(9));
    const opening = applyWallOpening(state, 2, [4, 2, 3]); // total 9
    expect(opening.openingSeatOffset).toBe(0);
    expect(opening.openingSeat).toBe(2);
    expect(opening.stacksPerSide).toBe(17);
    expect(opening.totalStacks).toBe(68);
    expect(opening.normalDrawStartStackIndex).toBe((2 * 17 + 9) % 68); // 43
  });

  it("reorders the wall without losing or duplicating any tile instance", () => {
    const state = createWall("north", rngFromSeed(5));
    const before = state.wall.map((t) => t.instanceId).sort((a, b) => a - b);
    applyWallOpening(state, 1, [6, 6, 6]); // total 18
    const after = state.wall.map((t) => t.instanceId).sort((a, b) => a - b);
    expect(after).toEqual(before);
    expect(state.wall).toHaveLength(before.length);
  });

  it("the reserved tail is always exactly the last 16 tiles of the opened wall", () => {
    for (const variant of ["north", "south"] as const) {
      const state = createWall(variant, rngFromSeed(11));
      applyWallOpening(state, 3, [1, 2, 3]); // total 6
      expect(state.tailStart).toBe(state.wall.length - TAIL_SIZE);
      expect(state.deckCursor).toBe(state.tailStart);
    }
  });

  it("rejects dice values that are not integers from 1 through 6", () => {
    const state = createWall("north", rngFromSeed(2));
    expect(() => applyWallOpening(state, 0, [1, 2])).toThrow(/three/);
    expect(() => applyWallOpening(state, 0, [0, 1, 2])).toThrow(/1 through 6/);
  });
});
