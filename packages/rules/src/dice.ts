/**
 * Dice (骰子) — Taiwan mahjong wall-opening dice.
 *
 * Authoritative Domain — `packages/rules`.
 *
 * The dealer rolls three dice (each 1–6, total 3–18). The total determines
 * the opening seat (開門位) and the wall break point (斷牌點) via
 * `applyWallOpening` in wall.ts — 台灣骰子定門.
 *
 * Values mirror the authoritative reference implementation (V1 dice.ts).
 */

import type { RngFn } from "./rng.js";

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** Exactly three die values. */
export type DiceValues = readonly [DieValue, DieValue, DieValue];

export interface DiceResult {
  values: DiceValues;
  total: number;
}

/** Validate three die values and compute the total (3–18). */
export function createDiceResult(values: readonly number[]): DiceResult {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new Error("Dice result requires exactly three die values");
  }
  const [first, second, third] = values;
  for (const v of [first, second, third]) {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 6) {
      throw new Error(`Each die must be an integer from 1 through 6, got ${v}`);
    }
  }
  const total = first + second + third;
  return {
    values: [first as DieValue, second as DieValue, third as DieValue],
    total,
  };
}

/** Roll three dice (each 1–6) from the given RNG. */
export function rollDice(rng: RngFn): DiceResult {
  const values = [
    (1 + Math.floor(rng() * 6)) as DieValue,
    (1 + Math.floor(rng() * 6)) as DieValue,
    (1 + Math.floor(rng() * 6)) as DieValue,
  ];
  return createDiceResult(values);
}
