/**
 * Scoring Engine (計分引擎) Golden Tests — Taiwan 16-tile Mahjong.
 *
 * Covers the fan matrix (自摸 / 門清 / 門清一摸三 / 碰碰胡 / 混一色 / 清一色 /
 * 暗刻高階取代 / 莊家連莊台), the 4台/8台 cap boundaries, and the four-player
 * zero-sum Ledger (the sum of the four deltas is always 0).
 *
 * All 38 cases (GC-01 … GC-38) are golden: expected values are pinned so the
 * authoritative server behaves deterministically.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, resetIds } from "./helpers.js";
import { evaluateFans, settleLedger, settleMultiLedger, type WinContext } from "../scoring.js";
import type { Meld } from "../types.js";
import type { TileInstance } from "../tiles.js";

// ---------------------------------------------------------------------------
// Hand builders (ids like "wan:3", "honor:dong")
// ---------------------------------------------------------------------------

function run(suit: string, start: number): string[] {
  return [`${suit}:${start}`, `${suit}:${start + 1}`, `${suit}:${start + 2}`];
}

function triple(id: string): string[] {
  return [id, id, id];
}

function pair(id: string): string[] {
  return [id, id];
}

function chiMeld(id: number, ids: string[]): Meld {
  const t = tiles(...ids);
  return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
}

function pengMeld(id: number, tid: string): Meld {
  const t = tiles(tid, tid, tid);
  return { id, kind: "peng", tiles: t, claimed: t[0]! };
}

// ---------------------------------------------------------------------------
// Reusable winning hands (17 tiles, unless noted)
// ---------------------------------------------------------------------------

/** 5 runs + pair, mixed wan/tong, no triplets, no honors. */
const RUNS_HAND = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7", "tong:7",
];

/** 3 runs + pair = 14 hand tiles (used with one open chi meld). */
const RUNS_HAND_OPEN = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:7", "tong:7",
];

/** 5 triplets + pair (concealed 碰碰胡). */
const ALL_TRIPLETS_HAND = [
  ...triple("wan:1"),
  ...triple("wan:2"),
  ...triple("wan:3"),
  ...triple("tong:4"),
  ...triple("tong:5"),
  ...pair("honor:zhong"),
];

/** 2 triplets + 3 runs + pair. */
const TWO_TRIPLETS_HAND = [
  ...triple("wan:1"),
  ...triple("tong:5"),
  ...run("wan", 2),
  ...run("wan", 5),
  ...run("tong", 1),
  ...pair("honor:zhong"),
];

/** 5 wan runs + honor pair → 混一色, no triplets. */
const MIXED_COLOR_HAND = [
  ...run("wan", 1),
  ...run("wan", 4),
  ...run("wan", 7),
  ...run("wan", 2),
  ...run("wan", 5),
  ...pair("honor:zhong"),
];

/**
 * 清一色: 5 wan runs + wan:9 pair. Note: by pigeonhole a 17-tile one-suit
 * runs hand always contains one concealed triplet — here wan:9×3 (789 run +
 * 99 pair) → 暗刻 +1 is part of the golden expectation.
 */
const PURE_ONE_SUIT_HAND = [
  ...run("wan", 1),
  ...run("wan", 4),
  ...run("wan", 7),
  ...run("wan", 2),
  ...run("wan", 5),
  ...pair("wan:9"),
];

/** 八對子: 7 pairs + 1 triplet = 17 tiles. */
const SEVEN_PAIRS_HAND = [
  ...pair("wan:1"), ...pair("wan:2"), ...pair("wan:3"),
  ...pair("wan:4"), ...pair("wan:5"), ...pair("wan:6"),
  ...pair("wan:7"), ...triple("tong:9"),
];

function ctx(partial: Partial<WinContext> & { hand: readonly TileInstance[] }): WinContext {
  return {
    winner: 0,
    selfDraw: false,
    dealer: 0,
    melds: [],
    dealerStreak: 1,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Fan matrix — 自摸 / 門清 / 門清一摸三
// ---------------------------------------------------------------------------

describe("evaluateFans — 基本台數 (自摸 / 門清 / 門清一摸三)", () => {
  beforeEach(() => resetIds());

  it("GC-01 放槍、門清、純順子: 僅 門清 +1", () => {
    const b = evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }));
    expect(b.fans).toEqual([{ rule: "門清", value: 1 }]);
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });

  it("GC-02 自摸、門清、純順子: 自摸1+門清1+門清一摸三3=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }));
    expect(b.rawTotal).toBe(5);
    expect(b.cap).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-03 自摸、門清、純順子 (8台頂標): raw 5 → total 5", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }), 8);
    expect(b.rawTotal).toBe(5);
    expect(b.cap).toBe(8);
    expect(b.total).toBe(5);
  });

  it("GC-04 放槍、1 吃、純順子: 無台 (raw 0)", () => {
    const b = evaluateFans(
      ctx({ hand: tiles(...RUNS_HAND_OPEN), melds: [chiMeld(1, run("wan", 1))] }),
    );
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
    expect(b.total).toBe(0);
  });

  it("GC-05 自摸、1 吃、純順子: 僅 自摸 +1", () => {
    const b = evaluateFans(
      ctx({ selfDraw: true, hand: tiles(...RUNS_HAND_OPEN), melds: [chiMeld(1, run("wan", 1))] }),
    );
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 碰碰胡
// ---------------------------------------------------------------------------

describe("evaluateFans — 碰碰胡", () => {
  beforeEach(() => resetIds());

  it("GC-06 放槍、門清、全刻子: 門清1+碰碰胡4=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
  });

  it("GC-07 放槍、門清、全刻子 (8台頂標): raw 5 → total 5", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(5);
  });

  it("GC-08 放槍、2 碰 + 3 刻: 碰碰胡 +4", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "碰碰胡", value: 4 }]);
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-09 自摸、門清、全刻子: 自摸1+門清1+門清一摸三3+碰碰胡4=9 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(9);
    expect(b.total).toBe(4);
    expect(b.fans).toEqual([
      { rule: "自摸", value: 1 },
      { rule: "門清", value: 1 },
      { rule: "門清一摸三", value: 3 },
      { rule: "碰碰胡", value: 4 },
    ]);
  });

  it("GC-10 放槍、有吃、混搭: 不構成碰碰胡 (raw 0)", () => {
    const hand = tiles(
      ...triple("wan:4"), ...triple("wan:5"),
      ...run("tong", 1), ...pair("tong:9"),
    );
    const melds = [chiMeld(1, run("wan", 1))];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-11 放槍、1 碰 + 純順子: 空刻子群不誤判碰碰胡 (raw 0)", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("tong", 1), ...pair("tong:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-12 八對子 (7對+1刻) 不誤判碰碰胡: 門清1+暗刻1=2", () => {
    const b = evaluateFans(ctx({ hand: tiles(...SEVEN_PAIRS_HAND) }));
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "暗刻高階取代", value: 1 },
    ]);
    expect(b.rawTotal).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 暗刻高階取代
// ---------------------------------------------------------------------------

describe("evaluateFans — 暗刻高階取代", () => {
  beforeEach(() => resetIds());

  it("GC-13 放槍、門清、2刻3順: 門清1+暗刻2=3", () => {
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "暗刻高階取代", value: 2 },
    ]);
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-14 自摸、門清、2刻3順: raw 7 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(7);
    expect(b.total).toBe(4);
  });

  it("GC-15 放槍、1 碰 + 2 刻: 有副露時暗刻不計 (raw 0)", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("tong:5"),
      ...run("wan", 2), ...run("tong", 1), ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([]);
    expect(b.rawTotal).toBe(0);
  });

  it("GC-16 碰碰胡時暗刻被高階取代 (不重複計算)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
    expect(b.fans.find((f) => f.rule === "暗刻高階取代")).toBeUndefined();
    expect(b.rawTotal).toBe(5); // 門清1 + 碰碰胡4，而非 1+4+5
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 混一色 / 清一色
// ---------------------------------------------------------------------------

describe("evaluateFans — 混一色 / 清一色", () => {
  beforeEach(() => resetIds());

  it("GC-17 放槍、門清、萬+字: 門清1+混一色4=5 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...MIXED_COLOR_HAND) }));
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
  });

  it("GC-18 放槍、1 字牌碰 + 純萬順子: 混一色 +4", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("wan", 2), ...pair("wan:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "混一色", value: 4 }]);
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
  });

  it("GC-19 放槍、門清、混一色碰碰胡: 門清1+碰碰胡4+混一色4=9 → 4台頂標", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("wan:3"),
      ...triple("honor:dong"), ...triple("honor:nan"), ...pair("honor:zhong"),
    );
    const b = evaluateFans(ctx({ hand }));
    expect(b.rawTotal).toBe(9);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
  });

  it("GC-20 放槍、門清、清一色(含1暗刻): 門清1+清一色8+暗刻1=10 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b.fans).toContainEqual({ rule: "清一色", value: 8 });
    expect(b.fans).toContainEqual({ rule: "暗刻高階取代", value: 1 });
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(4);
  });

  it("GC-21 清一色(含1暗刻) 8台頂標: raw 10 → total 8", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(8);
  });

  it("GC-22 放槍、1 吃、清一色: 清一色 +8", () => {
    const hand = tiles(
      ...run("wan", 4), ...run("wan", 7), ...run("wan", 2),
      ...run("wan", 5), ...pair("wan:9"),
    );
    const melds = [chiMeld(1, run("wan", 1))];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([{ rule: "清一色", value: 8 }]);
    expect(b.rawTotal).toBe(8);
    expect(b.total).toBe(4); // 預設 4台頂標
  });

  it("GC-23 自摸、門清、清一色(含1暗刻): raw 14 → 4台頂標 / 8台頂標", () => {
    const b4 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b4.rawTotal).toBe(14); // 1+1+3+8+1
    expect(b4.total).toBe(4);
    const b8 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b8.total).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 莊家連莊台
// ---------------------------------------------------------------------------

describe("evaluateFans — 莊家連莊台", () => {
  beforeEach(() => resetIds());

  it("GC-24 莊家(0)放槍胡、連莊2: 門清1+連莊1=2", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "莊家連莊台", value: 1 },
    ]);
    expect(b.rawTotal).toBe(2);
  });

  it("GC-25 莊家自摸、連莊3: raw 7 → 4台頂標", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, selfDraw: true, dealerStreak: 3, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(7);
    expect(b.total).toBe(4);
  });

  it("GC-26 非莊家胡牌、連莊2: 不加連莊台", () => {
    const b = evaluateFans(
      ctx({ winner: 1, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(1); // 僅 門清
    expect(b.fans.some((f) => f.rule === "莊家連莊台")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cap boundaries
// ---------------------------------------------------------------------------

describe("evaluateFans — 頂標 (cap) 邊界", () => {
  beforeEach(() => resetIds());

  it("GC-27 raw 恰等於 4台頂標: total 4, 未被下修", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("wan", 2), ...pair("wan:9"),
    );
    const melds = [pengMeld(1, "honor:dong")];
    const b = evaluateFans(ctx({ hand, melds })); // 混一色 4
    expect(b.rawTotal).toBe(4);
    expect(b.total).toBe(4);
    expect(b.cap).toBe(4);
  });

  it("GC-28 raw 低於頂標: total 保持原值", () => {
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) })); // raw 3
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-29 raw 超過頂標 1 台: 4台頂標截斷", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) })); // raw 5
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
  });

  it("GC-30 8台頂標邊界: raw 10 → total 8 (清一色+暗刻)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(8);
  });

  it("GC-31 cap 欄位正確回報", () => {
    expect(evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }), 4).cap).toBe(4);
    expect(evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }), 8).cap).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Ledger — four-player zero-sum
// ---------------------------------------------------------------------------

describe("settleLedger — 零和 Ledger", () => {
  beforeEach(() => resetIds());

  it("GC-32 自摸: 其餘三家各付全額, 四家總和為 0", () => {
    const c = ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }); // total 4
    expect(evaluateFans(c).total).toBe(4);
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 1200 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -400 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -400 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-33 自摸 (8台頂標): total 8 → 2400 / -800×3", () => {
    const hand = tiles(...PURE_ONE_SUIT_HAND);
    const c = ctx({ selfDraw: true, hand });
    expect(evaluateFans(c, 8).total).toBe(8);
    const ledger = settleLedger(c, 8);
    expect(ledger[0]!.delta).toBe(2400);
    expect(ledger[1]!.delta).toBe(-800);
    expect(ledger[2]!.delta).toBe(-800);
    expect(ledger[3]!.delta).toBe(-800);
  });

  it("GC-34 放槍: 放槍者付全額, 其餘兩家付半額, 總和為 0", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 2 }); // 碰碰胡 4 台
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 800 }); // 400 + 200 + 200
    expect(ledger[1]).toEqual({ seat: 1, delta: -200 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -200 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-35 放槍裸胡 (raw 0): 以最低 1 台計, 仍為零和", () => {
    const hand = tiles(...RUNS_HAND_OPEN);
    const melds = [chiMeld(1, run("wan", 1))];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 1 });
    expect(evaluateFans(c).total).toBe(0);
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 200 }); // 100 + 50 + 50
    expect(ledger[1]).toEqual({ seat: 1, delta: -100 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -50 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -50 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-36 自訂點數 pointPerFan=50: 放槍 4 台 → 200/100/100", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 2 });
    const ledger = settleLedger(c, 4, 50);
    expect(ledger[0]).toEqual({ seat: 0, delta: 400 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -100 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -200 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -100 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-37 奇數底分 pointPerFan=25, 3台: 半額無條件捨去仍零和", () => {
    const c = ctx({
      hand: tiles(...TWO_TRIPLETS_HAND),
      discardWin: true,
      discardWinSeat: 2,
    });
    const ledger = settleLedger(c, 4, 25);
    // total 3 → stake 75; 放槍者 -75, 其餘各 -37; 贏家 +149
    expect(ledger[0]).toEqual({ seat: 0, delta: 149 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -37 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -75 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -37 });
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-38 多情境零和性質 (sum of 4 deltas = 0)", () => {
    const cases: WinContext[] = [
      ctx({ selfDraw: true, hand: tiles(...ALL_TRIPLETS_HAND) }),
      ctx({ hand: tiles(...MIXED_COLOR_HAND), discardWin: true, discardWinSeat: 3 }),
      ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }),
      ctx({
        hand: tiles(...TWO_TRIPLETS_HAND),
        winner: 2,
        dealer: 0,
        discardWin: true,
        discardWinSeat: 1,
      }),
      ctx({ selfDraw: true, hand: tiles(...RUNS_HAND), winner: 3, dealer: 0, dealerStreak: 2 }),
    ];
    for (const c of cases) {
      const ledger = settleLedger(c, 8);
      const sum = ledger.reduce((acc, e) => acc + e.delta, 0);
      expect(sum).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Ledger — 一砲多響 (multi-win) zero-sum
// ---------------------------------------------------------------------------

describe("settleMultiLedger — 一砲多響零和", () => {
  beforeEach(() => resetIds());

  it("GC-39 一砲雙響：放槍者付全額給兩家，其餘付半額，總和為 0", () => {
    const c0 = ctx({
      winner: 0,
      hand: tiles(...ALL_TRIPLETS_HAND), // 門清碰碰胡: raw 5 → total 4
      discardWin: true,
      discardWinSeat: 3,
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...MIXED_COLOR_HAND), // 門清混一色: raw 5 → total 4
      discardWin: true,
      discardWinSeat: 3,
    });
    expect(evaluateFans(c0).total).toBe(4);
    expect(evaluateFans(c1).total).toBe(4);
    const ledger = settleMultiLedger([c0, c1]);
    // winner0 收到 +600 (放槍者 400 + seat2 半額 200)
    // winner1 收到 +600
    // seat2 付半額給兩家 = -400
    // seat3 (放槍者) 付全額給兩家 = -800
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
    expect(ledger[0]).toEqual({ seat: 0, delta: 600 });
    expect(ledger[1]).toEqual({ seat: 1, delta: 600 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -400 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -800 });
  });

  it("GC-40 一砲三響：三家胡同一張棄牌，總和為 0", () => {
    const hands = [ALL_TRIPLETS_HAND, MIXED_COLOR_HAND, PURE_ONE_SUIT_HAND];
    const winners = [0, 1, 2];
    const discarder = 3;
    const ctxs = winners.map((w, i) =>
      ctx({
        winner: w,
        hand: tiles(...hands[i]!),
        discardWin: true,
        discardWinSeat: discarder,
      }),
    );
    const ledger = settleMultiLedger(ctxs, 8);
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
    // 只有放槍者 seat3 與未胡者 seat? （三響時除 seat3 外無人付半額）
    // 三家皆胡 → 無半額付費者，放槍者付三家全額。
    expect(ledger[3]!.delta).toBeLessThan(0);
    expect(ledger.filter((e) => e.delta > 0).length).toBe(3);
  });

  it("GC-41 奇數底分一砲雙響：半額無條件捨去仍零和", () => {
    const c0 = ctx({
      winner: 0,
      hand: tiles(...TWO_TRIPLETS_HAND), // raw 3 → total 3
      discardWin: true,
      discardWinSeat: 3,
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...RUNS_HAND), // raw 1 → total 1
      discardWin: true,
      discardWinSeat: 3,
    });
    // pointPerFan=25：stake0=75, stake1=25
    const ledger = settleMultiLedger([c0, c1], 4, 25);
    // seat0 收放槍者全額 75 + seat2 半額 floor(75/2)=37 → +112
    // seat1 收放槍者全額 25 + seat2 半額 floor(25/2)=12 → +37
    // seat2 付半額給兩家 = -floor(75/2)37 - floor(25/2)12 = -49
    // seat3 放槍者付全額 = -75 -25 = -100
    expect(ledger.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });

  it("GC-42 放槍者也是胡家之一（退化 case）：仍嚴格零和", () => {
    // 場景：seat 0 放槍，同時 seat 0 和 seat 1 都胡牌（罕見但規則允許）。
    // seat0 作為胡家不向自己收錢；seat1 作為胡家收 seat2/3 半額。
    // sum(delta) 必須 === 0。
    const c0 = ctx({
      winner: 0,
      hand: tiles(...ALL_TRIPLETS_HAND), // 4 fan
      discardWin: true,
      discardWinSeat: 0, // 放槍者 = 胡家
    });
    const c1 = ctx({
      winner: 1,
      hand: tiles(...RUNS_HAND), // 1 fan
      discardWin: true,
      discardWinSeat: 0, // 同一放槍者
    });
    const ledger = settleMultiLedger([c0, c1]);
    const sum = ledger.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // seat0 (放槍者兼胡家) 仍應是正或零（不會被自己扣錢）。
    expect(ledger.find((e) => e.seat === 0)!.delta).toBeGreaterThanOrEqual(0);
  });

  it("GC-43 單胡家 settleMultiLedger 與 settleLedger 結果相同", () => {
    const c = ctx({
      winner: 1,
      hand: tiles(...ALL_TRIPLETS_HAND),
      discardWin: true,
      discardWinSeat: 3,
    });
    const multi = settleMultiLedger([c]);
    const single = settleLedger(c);
    for (let seat = 0; seat < 4; seat++) {
      expect(multi.find((e) => e.seat === seat)!.delta).toBe(
        single.find((e) => e.seat === seat)!.delta,
      );
    }
  });
});
