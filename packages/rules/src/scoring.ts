/**
 * Scoring Engine (計分引擎) — server-authoritative.
 *
 * Implements the Taiwan 16-tile fan (台數) matrix, a configurable fan cap
 * (default 4台, configurable to 8台), and a four-player zero-sum Ledger.
 *
 * 合法可胡即自動胡牌: scoring runs automatically once a win is declared.
 */

import type { Meld } from "./types.js";
import type { Tile, TileInstance } from "./tiles.js";
import { tileFromId, tileToId } from "./tiles.js";
import { countById } from "./win.js";

/** Fan cap options. */
export type FanCap = 4 | 8;

export interface WinContext {
  /** The winner's seat. */
  winner: number;
  /** Whether the win was a self-draw (自摸). */
  selfDraw: boolean;
  /** True when the win came from a kong replacement (槓上開花). */
  kongDraw?: boolean;
  /** True when the win was off a discard (放槍). */
  discardWin?: boolean;
  /** Seat that discarded the winning tile (放槍者), if any. */
  discardWinSeat?: number;
  /** Consecutive dealer wins (連莊). */
  dealerStreak?: number;
  /** The dealer's seat. */
  dealer: number;
  /** The winner's hand (14 for discard win, 15+ for self-draw with kong... adjusted by melds). */
  hand: readonly TileInstance[];
  /** The winner's open melds. */
  melds: readonly Meld[];
}

export interface FanBreakdown {
  /** Each applied fan rule and its value. */
  fans: Array<{ rule: string; value: number }>;
  /** Total fans before cap. */
  rawTotal: number;
  /** Applied cap. */
  cap: FanCap;
  /** Total fans after cap. */
  total: number;
}

/** A rule that inspects the win and returns 0 or a positive fan value. */
type FanRule = (ctx: WinContext) => number;

const FAN_RULES: Array<{ rule: string; fn: FanRule }> = [
  // 規則待確認：現行「自摸(1)」「門清(1)」「門清一摸三(3)」在門清自摸時會
  // 同時加總（1+1+3=5）。部分台灣北部牌例把「門清一摸三」視為取代前兩者的
  // 高階台，此處保留既有疊加語意，待規則確認後再調整，不 silent 改分。
  { rule: "自摸", fn: (c) => (c.selfDraw ? 1 : 0) },
  { rule: "門清", fn: (c) => (c.melds.length === 0 ? 1 : 0) },
  {
    rule: "門清一摸三",
    fn: (c) => (c.selfDraw && c.melds.length === 0 ? 3 : 0),
  },
  {
    rule: "碰碰胡",
    fn: (c) => (isPengHu(c) ? 4 : 0),
  },
  {
    rule: "混一色",
    fn: (c) => {
      const suits = distinctSuits(c);
      return suits.size === 2 && suits.has("honor") ? 4 : 0;
    },
  },
  {
    rule: "清一色",
    fn: (c) => (distinctSuits(c).size === 1 ? 8 : 0),
  },
  {
    rule: "暗刻高階取代",
    // Each concealed triplet is worth 1 fan. When 碰碰胡 (higher) applies, the
    // concealed-triplet fans are replaced by it (高階取代) to avoid double count.
    fn: (c) => (isPengHu(c) ? 0 : countClosedTriplets(c)),
  },
  {
    rule: "莊家連莊台",
    fn: (c) => (c.winner === c.dealer && (c.dealerStreak ?? 1) > 1 ? c.dealerStreak! - 1 : 0),
  },
];

/** Isolate concealed groups from a concealed hand (no melds): 4 triplets/runs + pair. */
function concealedGroups(hand: readonly TileInstance[]): Tile[][] {
  // Split into triplets by identity first.
  const counts = countById(hand);
  const groups: Tile[][] = [];
  for (const [id, rawCount] of counts) {
    const tile = tileFromId(id);
    let remaining = rawCount;
    while (remaining >= 3) {
      groups.push([tile, tile, tile]);
      remaining -= 3;
    }
  }
  return groups;
}

function allMeldsAreTriplets(groups: readonly Tile[][]): boolean {
  if (groups.length === 0) return false; // a runs-only concealed portion is never 碰碰胡
  return groups.every((g) => g.length === 3 && g.every((t) => tileToId(t) === tileToId(g[0]!)));
}

/**
 * 碰碰胡 (all-pong): no chi melds, every concealed group is a triplet, and the
 * total number of groups (concealed triplets + open melds) is exactly 5.
 */
function isPengHu(c: WinContext): boolean {
  if (c.melds.some((m) => m.kind === "chi")) return false;
  const concealed = concealedGroups(c.hand);
  if (!allMeldsAreTriplets(concealed)) return false;
  return concealed.length + c.melds.length === 5;
}

/** Count closed triplets in the concealed hand (each counts as 1 fan). */
function countClosedTriplets(c: WinContext): number {
  if (c.melds.length > 0) return 0; // only pure concealed hands count (simplification)
  const counts = countById(c.hand);
  let triplets = 0;
  for (const count of counts.values()) {
    if (count === 3) triplets += 1;
  }
  return triplets;
}

function distinctSuits(c: WinContext): Set<string> {
  const suits = new Set<string>();
  const addTile = (t: Tile) => {
    if (t.kind === "numbered") suits.add(t.suit);
    else if (t.kind === "honor") suits.add("honor");
  };
  for (const inst of c.hand) addTile(inst.tile);
  for (const m of c.melds) for (const inst of m.tiles) addTile(inst.tile);
  return suits;
}

/** Evaluate the fan breakdown for a win. */
export function evaluateFans(ctx: WinContext, cap: FanCap = 4): FanBreakdown {
  const fans: FanBreakdown["fans"] = [];
  for (const { rule, fn } of FAN_RULES) {
    const value = fn(ctx);
    if (value > 0) fans.push({ rule, value });
  }
  const rawTotal = fans.reduce((acc, f) => acc + f.value, 0);
  const total = Math.min(rawTotal, cap);
  return { fans, rawTotal, cap, total };
}

// ---------------------------------------------------------------------------
// Ledger — four-player zero-sum
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  seat: number;
  /** Signed balance delta for this hand. */
  delta: number;
}

/**
 * Compute the four-player settlement for a win.
 *
 * In Taiwan 16-tile mahjong, base points are derived from the fan total.
 * We use a configurable point-per-fan table; the payout flows from losers to
 * the winner such that the sum of all four deltas is exactly 0.
 */
export function settleLedger(
  ctx: WinContext,
  cap: FanCap = 4,
  pointPerFan: number = 100,
): LedgerEntry[] {
  const breakdown = evaluateFans(ctx, cap);
  const total = breakdown.total || 1; // a bare win is at least 1 fan
  const stake = total * pointPerFan;

  const deltas: LedgerEntry[] = [
    { seat: 0, delta: 0 },
    { seat: 1, delta: 0 },
    { seat: 2, delta: 0 },
    { seat: 3, delta: 0 },
  ];

  if (ctx.selfDraw) {
    // Self-draw: every other player pays the full stake to the winner.
    for (let seat = 0; seat < 4; seat++) {
      if (seat === ctx.winner) continue;
      deltas[seat]!.delta -= stake;
      deltas[ctx.winner]!.delta += stake;
    }
  } else {
    // Discard win: the discarder pays the full stake; others pay half.
    const discarder = ctx.discardWinSeat ?? -1;
    if (discarder !== -1) {
      for (let seat = 0; seat < 4; seat++) {
        if (seat === ctx.winner) continue;
        const pay = seat === discarder ? stake : Math.floor(stake / 2);
        deltas[seat]!.delta -= pay;
        deltas[ctx.winner]!.delta += pay;
      }
    }
  }
  return deltas;
}

/**
 * 一砲多響 (multi-win) settlement — compute the four-player zero-sum ledger when
 * MULTIPLE winners settle on the same discard (each with their own fan
 * breakdown / stake).
 *
 * Rules:
 *  - Every winner is paid by the discarder (放槍者) at the full stake.
 *  - Every other non-winning player pays half the stake to each winner.
 *  - Winners never pay each other (a winner is never also a payer).
 * The discarder's total loss is the sum of the stakes of all winners; the
 * ledger always sums to exactly 0.
 */
export function settleMultiLedger(
  ctxs: readonly WinContext[],
  cap: FanCap = 4,
  pointPerFan: number = 100,
): LedgerEntry[] {
  const deltas: LedgerEntry[] = [
    { seat: 0, delta: 0 },
    { seat: 1, delta: 0 },
    { seat: 2, delta: 0 },
    { seat: 3, delta: 0 },
  ];
  const winners = new Set<number>(ctxs.map((c) => c.winner));
  for (const ctx of ctxs) {
    const breakdown = evaluateFans(ctx, cap);
    const total = breakdown.total || 1; // a bare win is at least 1 fan
    const stake = total * pointPerFan;
    if (ctx.selfDraw) {
      // Self-draw (unusual for multi-win, but keep it zero-sum): every
      // non-winning player pays the full stake to this winner.
      for (let seat = 0; seat < 4; seat++) {
        if (winners.has(seat)) continue;
        deltas[seat]!.delta -= stake;
        deltas[ctx.winner]!.delta += stake;
      }
    } else {
      // Discard win: the discarder pays full; non-winning others pay half.
      const discarder = ctx.discardWinSeat ?? -1;
      if (discarder !== -1) {
        for (let seat = 0; seat < 4; seat++) {
          if (seat === ctx.winner || winners.has(seat)) continue;
          const pay = seat === discarder ? stake : Math.floor(stake / 2);
          deltas[seat]!.delta -= pay;
          deltas[ctx.winner]!.delta += pay;
        }
      }
    }
  }
  return deltas;
}

// Re-export helpers used by tests/scoring.
export { countById };
