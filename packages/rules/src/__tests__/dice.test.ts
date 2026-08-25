/**
 * Dice (骰子) unit tests — Taiwan wall-opening dice validation.
 */

import { describe, expect, it } from "vitest";
import { rngFromSeed } from "../rng.js";
import { createDiceResult, rollDice } from "../dice.js";

describe("dice — createDiceResult", () => {
  it("accepts three valid die values and computes the total", () => {
    const r = createDiceResult([3, 5, 6]);
    expect(r.total).toBe(14);
    expect(r.values).toEqual([3, 5, 6]);
  });

  it("rejects fewer / more than three dice", () => {
    expect(() => createDiceResult([1, 2])).toThrow(/three/);
    expect(() => createDiceResult([1, 2, 3, 4])).toThrow(/three/);
  });

  it("rejects non-integer and out-of-range die values", () => {
    expect(() => createDiceResult([0, 1, 2])).toThrow(/1 through 6/);
    expect(() => createDiceResult([7, 1, 2])).toThrow(/1 through 6/);
    expect(() => createDiceResult([1.5, 1, 2])).toThrow(/1 through 6/);
  });

  it("the dice total is always 3..18", () => {
    for (const seed of [1, 42, 12345]) {
      const rng = rngFromSeed(seed);
      for (let i = 0; i < 50; i++) {
        const r = rollDice(rng);
        expect(r.total).toBeGreaterThanOrEqual(3);
        expect(r.total).toBeLessThanOrEqual(18);
      }
    }
  });

  it("rollDice is deterministic for a given seed", () => {
    const a = rollDice(rngFromSeed(7));
    const b = rollDice(rngFromSeed(7));
    expect(a).toEqual(b);
  });
});
