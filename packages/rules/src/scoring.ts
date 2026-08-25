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
import { analyzeWait, hasAllChowsStructure, hasExclusiveWaitRole, type WaitRole } from "./wait.js";

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
  /** Round wind: 0: East, 1: South, 2: West, 3: North. Defaults to 0 (East). */
  roundWind?: number;
  /** True when winning by robbing an add-on kong (搶槓). */
  robbedKong?: boolean;
  /** True when winning on the final available wall draw (海底撈月). */
  lastTileDraw?: boolean;
  /** True when dealer wins on initial deal (天胡). */
  tianHu?: boolean;
  /** True when non-dealer self-draws on the very first turn without open melds (地胡). */
  diHu?: boolean;
  /** Flowers collected by the winner. */
  flowers?: readonly TileInstance[];
  /** The tile that completed the winning hand (last discard / drawn tile / robbed kong tile). */
  winningTile?: TileInstance;
  /** Regional variant — 邊張/坎張/單吊 are NORTH-only (defaults to north). */
  variant?: "north" | "south";
  /** True when winning off the discard of the final wall tile (河底撈魚). */
  riverBottomDiscardWin?: boolean;
  /** Evaluate optional honor & wind triplets (default true for extended, false for legacy strict). */
  evalHonors?: boolean;
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

function getTripletCounts(c: WinContext): Map<string, number> {
  const counts = countById(c.hand);
  const tripletMap = new Map<string, number>();
  for (const [id, count] of counts) {
    if (count >= 3) {
      tripletMap.set(id, Math.floor(count / 3));
    }
  }
  for (const m of c.melds) {
    if (m.kind === "peng" || m.kind === "kong") {
      const id = tileToId(m.claimed?.tile ?? m.tiles[0]!.tile);
      tripletMap.set(id, (tripletMap.get(id) ?? 0) + 1);
    }
  }
  return tripletMap;
}

function hasPairOf(c: WinContext, id: string): boolean {
  const counts = countById(c.hand);
  return (counts.get(id) ?? 0) >= 2;
}

function isBigThreeDragons(c: WinContext): boolean {
  const triplets = getTripletCounts(c);
  return (
    (triplets.get("honor:zhong") ?? 0) >= 1 &&
    (triplets.get("honor:fa") ?? 0) >= 1 &&
    (triplets.get("honor:bai") ?? 0) >= 1
  );
}

function isSmallThreeDragons(c: WinContext): boolean {
  if (isBigThreeDragons(c)) return false;
  const triplets = getTripletCounts(c);
  const dragons = ["honor:zhong", "honor:fa", "honor:bai"];
  const tripCount = dragons.filter((d) => (triplets.get(d) ?? 0) >= 1).length;
  const pairCount = dragons.filter(
    (d) => hasPairOf(c, d) && (triplets.get(d) ?? 0) === 0,
  ).length;
  return tripCount === 2 && pairCount >= 1;
}

function isBigFourWinds(c: WinContext): boolean {
  const triplets = getTripletCounts(c);
  const winds = ["honor:dong", "honor:nan", "honor:xi", "honor:bei"];
  return winds.every((w) => (triplets.get(w) ?? 0) >= 1);
}

function isSmallFourWinds(c: WinContext): boolean {
  if (isBigFourWinds(c)) return false;
  const triplets = getTripletCounts(c);
  const winds = ["honor:dong", "honor:nan", "honor:xi", "honor:bei"];
  const tripCount = winds.filter((w) => (triplets.get(w) ?? 0) >= 1).length;
  const pairCount = winds.filter(
    (w) => hasPairOf(c, w) && (triplets.get(w) ?? 0) === 0,
  ).length;
  return tripCount === 3 && pairCount >= 1;
}

function isAllHonors(c: WinContext): boolean {
  if (c.hand.length === 0 && c.melds.length === 0) return false;
  for (const inst of c.hand) {
    if (inst.tile.kind !== "honor") return false;
  }
  for (const m of c.melds) {
    for (const inst of m.tiles) {
      if (inst.tile.kind !== "honor") return false;
    }
  }
  return true;
}

function countFlowerFans(c: WinContext): number {
  if (!c.flowers || c.flowers.length === 0) return 0;
  let fans = 0;
  const flowerIds = new Set(c.flowers.map((f) => tileToId(f.tile)));

  // 八仙過海 (8 fans)
  if (flowerIds.size === 8) return 8;
  // 七搶一 (8 fans)
  if (flowerIds.size === 7) return 8;

  // 花槓: 春夏秋冬 (2 fans) / 梅蘭竹菊 (2 fans)
  const seasons = ["flower:chun", "flower:xia", "flower:qiu", "flower:dong"];
  const plants = ["flower:mei", "flower:lan", "flower:zhu", "flower:ju"];
  if (seasons.every((id) => flowerIds.has(id))) fans += 2;
  if (plants.every((id) => flowerIds.has(id))) fans += 2;

  // 正花 (1 fan each): winner seat relative to dealer
  const seatWind = (c.winner - c.dealer + 4) % 4;
  const seatFlowers = [
    ["flower:chun", "flower:mei"], // 東
    ["flower:xia", "flower:lan"], // 南
    ["flower:qiu", "flower:zhu"], // 西
    ["flower:dong", "flower:ju"], // 北
  ][seatWind]!;

  for (const sf of seatFlowers) {
    if (flowerIds.has(sf)) fans += 1;
  }
  return fans;
}

const FAN_RULES: Array<{ rule: string; fn: FanRule }> = [
  { rule: "天胡", fn: (c) => (c.tianHu ? 24 : 0) },
  { rule: "地胡", fn: (c) => (c.diHu ? 16 : 0) },
  {
    rule: "自摸",
    // 門清自摸由 門清一摸三 取代 (互斥取高), so 自摸 only counts with open melds.
    fn: (c) => (c.selfDraw && c.melds.length > 0 ? 1 : 0),
  },
  {
    rule: "門清",
    // 門清自摸由 門清一摸三 取代; 五暗刻 (更高) 取代 門清.
    fn: (c) =>
      c.melds.length === 0 && !c.selfDraw && countConcealedTriplets(c) < 5 ? 1 : 0,
  },
  {
    rule: "門清一摸三",
    fn: (c) => (c.selfDraw && c.melds.length === 0 ? 3 : 0),
  },
  {
    rule: "平胡",
    fn: (c) => (isPingHu(c) ? 2 : 0),
  },
  {
    rule: "碰碰胡",
    // 五暗刻 (更高) 取代 碰碰胡.
    fn: (c) => (isPengHu(c) && countConcealedTriplets(c) < 5 ? 4 : 0),
  },
  {
    rule: "混一色",
    fn: (c) => {
      if (isAllHonors(c)) return 0;
      const suits = distinctSuits(c);
      return suits.size === 2 && suits.has("honor") ? 4 : 0;
    },
  },
  {
    rule: "清一色",
    fn: (c) => (distinctSuits(c).size === 1 && !isAllHonors(c) ? 8 : 0),
  },
  {
    rule: "字一色",
    fn: (c) => (isAllHonors(c) ? 16 : 0),
  },
  {
    rule: "大三元",
    fn: (c) => (isBigThreeDragons(c) ? 8 : 0),
  },
  {
    rule: "小三元",
    fn: (c) => (isSmallThreeDragons(c) ? 4 : 0),
  },
  {
    rule: "大四喜",
    fn: (c) => (isBigFourWinds(c) ? 16 : 0),
  },
  {
    rule: "小四喜",
    fn: (c) => (isSmallFourWinds(c) ? 8 : 0),
  },
  {
    rule: "全求人",
    fn: (c) => (isAllExposed(c) ? 2 : 0),
  },
  {
    rule: "三暗刻",
    fn: (c) => (countConcealedTriplets(c) === 3 ? 2 : 0),
  },
  {
    rule: "四暗刻",
    fn: (c) => (countConcealedTriplets(c) === 4 ? 5 : 0),
  },
  {
    rule: "五暗刻",
    fn: (c) => (countConcealedTriplets(c) === 5 ? 8 : 0),
  },
  {
    rule: "邊張",
    fn: (c) => (isNorthVariant(c) && hasExclusiveWait(c, "EDGE") ? 1 : 0),
  },
  {
    rule: "坎張",
    fn: (c) => (isNorthVariant(c) && hasExclusiveWait(c, "CLOSED") ? 1 : 0),
  },
  {
    rule: "單吊",
    // 全求人 (更高) 取代 單吊.
    fn: (c) =>
      isNorthVariant(c) && hasExclusiveWait(c, "SINGLE") && !isAllExposed(c) ? 1 : 0,
  },
  {
    rule: "槓上開花",
    fn: (c) => (c.kongDraw ? 1 : 0),
  },
  {
    rule: "搶槓",
    fn: (c) => (c.robbedKong ? 1 : 0),
  },
  {
    rule: "海底撈月",
    fn: (c) => (c.lastTileDraw ? 1 : 0),
  },
  {
    rule: "河底撈魚",
    fn: (c) => (c.riverBottomDiscardWin ? 1 : 0),
  },
  {
    rule: "花牌",
    fn: (c) => countFlowerFans(c),
  },
  {
    rule: "莊家連莊台",
    fn: (c) => (c.winner === c.dealer && (c.dealerStreak ?? 1) > 1 ? c.dealerStreak! - 1 : 0),
  },
];

// ---------------------------------------------------------------------------
// Helpers for the extended fan matrix
// ---------------------------------------------------------------------------

/** 邊張/坎張/單吊 are NORTH-only regional patterns (default = north). */
function isNorthVariant(c: WinContext): boolean {
  return (c.variant ?? "north") === "north";
}

/** Exclusive single-wait role analysis for the winning tile. */
function hasExclusiveWait(c: WinContext, role: WaitRole): boolean {
  if (!c.winningTile) return false;
  const analysis = analyzeWait(c.hand, c.melds, c.winningTile);
  return analysis !== null && hasExclusiveWaitRole(analysis, role);
}

/**
 * 平胡 (all chows): every group is a sequence, discard win, no flowers, and the
 * wait is open (not 邊張/坎張/單吊).
 */
function isPingHu(c: WinContext): boolean {
  if (c.selfDraw) return false;
  if (c.flowers && c.flowers.length > 0) return false;
  if (!hasAllChowsStructure(c.hand, c.melds)) return false;
  // 邊張/坎張/單吊 are NORTH-only — they only disqualify 平胡 where they apply.
  if (
    isNorthVariant(c) &&
    (hasExclusiveWait(c, "EDGE") ||
      hasExclusiveWait(c, "CLOSED") ||
      hasExclusiveWait(c, "SINGLE"))
  ) {
    return false;
  }
  return true;
}

/**
 * 全求人 (all exposed): all four groups are open melds and the win comes off a
 * discard with the pair won by 單吊.
 */
function isAllExposed(c: WinContext): boolean {
  if (c.selfDraw) return false;
  if (c.melds.length !== 4) return false;
  if (!c.winningTile) return false;
  const analysis = analyzeWait(c.hand, c.melds, c.winningTile);
  return analysis !== null && hasExclusiveWaitRole(analysis, "SINGLE");
}

/**
 * Count concealed triplets (暗刻): triplets inside the concealed hand plus
 * concealed kongs. Used for 三/四/五暗刻.
 */
function countConcealedTriplets(c: WinContext): number {
  const counts = countById(c.hand);
  let triplets = 0;
  for (const count of counts.values()) {
    triplets += Math.floor(count / 3);
  }
  for (const m of c.melds) {
    if (m.kind === "kong" && m.kongType === "closed") triplets += 1;
  }
  return triplets;
}


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
