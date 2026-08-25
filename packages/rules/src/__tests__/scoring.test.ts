/**
 * Scoring Engine (計分引擎) Golden Tests — Taiwan 16-tile Mahjong.
 *
 * Covers the fan matrix (自摸 / 門清 / 門清一摸三 / 平胡 / 碰碰胡 / 混一色 /
 * 清一色 / 三·四·五暗刻 / 邊張·坎張·單吊 / 全求人 / 莊家連莊台 / 花牌), the
 * 4台/8台 cap boundaries, and the four-player zero-sum Ledger (the sum of the
 * four deltas is always 0).
 *
 * All cases are golden: expected values are pinned so the authoritative server
 * behaves deterministically. 門清自摸 = 門清一摸三 3 台（互斥取高，取代自摸+門清）.
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

/** Find the LAST instance whose identity matches (the winning copy is placed last). */
function byFaceIdLast(hand: readonly TileInstance[], faceId: string): TileInstance {
  for (let i = hand.length - 1; i >= 0; i--) {
    const t = hand[i]!.tile;
    const id =
      t.kind === "flower" ? `flower:${t.flower}` : t.kind === "honor" ? `honor:${t.honor}` : `${t.suit}:${t.rank}`;
    if (id === faceId) return hand[i]!;
  }
  throw new Error(`Tile ${faceId} not found`);
}

/** Find the FIRST instance whose identity matches (single-copy faces only). */
function byFaceId(hand: readonly TileInstance[], faceId: string): TileInstance {
  for (const t of hand) {
    const id =
      t.tile.kind === "flower"
        ? `flower:${t.tile.flower}`
        : t.tile.kind === "honor"
          ? `honor:${t.tile.honor}`
          : `${t.tile.suit}:${t.tile.rank}`;
    if (id === faceId) return t;
  }
  throw new Error(`Tile ${faceId} not found`);
}

// ---------------------------------------------------------------------------
// Fan matrix — 自摸 / 門清 / 門清一摸三
// ---------------------------------------------------------------------------

describe("evaluateFans — 基本台數 (自摸 / 門清 / 門清一摸三)", () => {
  beforeEach(() => resetIds());

  it("GC-01 放槍、門清、純順子: 門清1 + 平胡2 = 3", () => {
    const b = evaluateFans(ctx({ hand: tiles(...RUNS_HAND) }));
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "平胡", value: 2 },
    ]);
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-02 自摸、門清、純順子: 門清一摸三3 (取代自摸+門清) → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }));
    expect(b.rawTotal).toBe(3);
    expect(b.cap).toBe(4);
    expect(b.total).toBe(3);
  });

  it("GC-03 自摸、門清、純順子 (8台頂標): raw 3 → total 3", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }), 8);
    expect(b.rawTotal).toBe(3);
    expect(b.cap).toBe(8);
    expect(b.total).toBe(3);
  });

  it("GC-04 放槍、1 吃、純順子: 平胡 2", () => {
    const b = evaluateFans(
      ctx({ hand: tiles(...RUNS_HAND_OPEN), melds: [chiMeld(1, run("wan", 1))] }),
    );
    expect(b.fans).toEqual([{ rule: "平胡", value: 2 }]);
    expect(b.rawTotal).toBe(2);
    expect(b.total).toBe(2);
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

  it("GC-06 放槍、門清、全刻子: 五暗刻8 (取代碰碰胡+門清) → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(8);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "五暗刻", value: 8 });
  });

  it("GC-07 放槍、門清、全刻子 (8台頂標): raw 8 → total 8", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.rawTotal).toBe(8);
    expect(b.total).toBe(8);
  });

  it("GC-08 放槍、2 碰 + 3 刻: 三暗刻2 + 碰碰胡4 = 6", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([
      { rule: "碰碰胡", value: 4 },
      { rule: "三暗刻", value: 2 },
    ]);
    expect(b.rawTotal).toBe(6);
    expect(b.total).toBe(4);
  });

  it("GC-09 自摸、門清、全刻子: 五暗刻8 + 門清一摸三3 = 11 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...ALL_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(11);
    expect(b.total).toBe(4);
    expect(b.fans).toEqual([
      { rule: "門清一摸三", value: 3 },
      { rule: "五暗刻", value: 8 },
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

  it("GC-12 八對子 (7對+1刻) 不誤判碰碰胡/平胡: 僅 門清1", () => {
    const b = evaluateFans(ctx({ hand: tiles(...SEVEN_PAIRS_HAND) }));
    expect(b.fans).toEqual([{ rule: "門清", value: 1 }]);
    expect(b.rawTotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 暗刻高階取代
// ---------------------------------------------------------------------------

describe("evaluateFans — 暗刻高階取代", () => {
  beforeEach(() => resetIds());

  it("GC-13 放槍、門清、2刻3順: 門清1 (2暗刻未達三暗刻門檻)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.fans).toEqual([{ rule: "門清", value: 1 }]);
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });

  it("GC-14 自摸、門清、2刻3順: 門清一摸三3 → 4台頂標", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...TWO_TRIPLETS_HAND) }));
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
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

  it("GC-16 五暗刻時碰碰胡/三暗刻被高階取代 (不重複計算)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...ALL_TRIPLETS_HAND) }), 8);
    expect(b.fans).toContainEqual({ rule: "五暗刻", value: 8 });
    expect(b.fans.find((f) => f.rule === "碰碰胡")).toBeUndefined();
    expect(b.fans.find((f) => f.rule === "三暗刻")).toBeUndefined();
    expect(b.fans.find((f) => f.rule === "四暗刻")).toBeUndefined();
    expect(b.rawTotal).toBe(8); // 五暗刻 8，而非 門清+碰碰胡+暗刻
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 混一色 / 清一色
// ---------------------------------------------------------------------------

describe("evaluateFans — 混一色 / 清一色", () => {
  beforeEach(() => resetIds());

  it("GC-17 放槍、門清、萬+字: 門清1+混一色4+平胡2=7 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...MIXED_COLOR_HAND) }));
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.fans).toContainEqual({ rule: "平胡", value: 2 });
    expect(b.rawTotal).toBe(7);
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

  it("GC-19 放槍、門清、混一色碰碰胡: 五暗刻8+混一色4=12 → 4台頂標", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("wan:3"),
      ...triple("honor:dong"), ...triple("honor:nan"), ...pair("honor:zhong"),
    );
    const b = evaluateFans(ctx({ hand }));
    expect(b.rawTotal).toBe(12);
    expect(b.total).toBe(4);
    expect(b.fans).toContainEqual({ rule: "混一色", value: 4 });
    expect(b.fans).toContainEqual({ rule: "五暗刻", value: 8 });
  });

  it("GC-20 放槍、門清、清一色(含1暗刻): 門清1+平胡2+清一色8=11 → 4台頂標", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b.fans).toContainEqual({ rule: "清一色", value: 8 });
    expect(b.fans).toContainEqual({ rule: "平胡", value: 2 });
    expect(b.rawTotal).toBe(11);
    expect(b.total).toBe(4);
  });

  it("GC-21 清一色(含1暗刻) 8台頂標: raw 11 → total 8", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(11);
    expect(b.total).toBe(8);
  });

  it("GC-22 放槍、1 吃、清一色: 清一色8 + 平胡2 = 10", () => {
    const hand = tiles(
      ...run("wan", 4), ...run("wan", 7), ...run("wan", 2),
      ...run("wan", 5), ...pair("wan:9"),
    );
    const melds = [chiMeld(1, run("wan", 1))];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toEqual([
      { rule: "平胡", value: 2 },
      { rule: "清一色", value: 8 },
    ]);
    expect(b.rawTotal).toBe(10);
    expect(b.total).toBe(4); // 預設 4台頂標
  });

  it("GC-23 自摸、門清、清一色(含1暗刻): raw 11 → 4台頂標 / 8台頂標", () => {
    const b4 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }));
    expect(b4.rawTotal).toBe(11); // 門清一摸三3 + 清一色8
    expect(b4.total).toBe(4);
    const b8 = evaluateFans(ctx({ selfDraw: true, hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b8.rawTotal).toBe(11);
    expect(b8.total).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 莊家連莊台
// ---------------------------------------------------------------------------

describe("evaluateFans — 莊家連莊台", () => {
  beforeEach(() => resetIds());

  it("GC-24 莊家(0)放槍胡、連莊2: 門清1+平胡2+連莊1=4", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.fans).toEqual([
      { rule: "門清", value: 1 },
      { rule: "平胡", value: 2 },
      { rule: "莊家連莊台", value: 1 },
    ]);
    expect(b.rawTotal).toBe(4);
  });

  it("GC-25 莊家自摸、連莊3: 門清一摸三3+連莊2=5 → 4台頂標", () => {
    const b = evaluateFans(
      ctx({ winner: 0, dealer: 0, selfDraw: true, dealerStreak: 3, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(5);
    expect(b.total).toBe(4);
  });

  it("GC-26 非莊家胡牌、連莊2: 不加連莊台 (門清1+平胡2=3)", () => {
    const b = evaluateFans(
      ctx({ winner: 1, dealer: 0, dealerStreak: 2, hand: tiles(...RUNS_HAND) }),
    );
    expect(b.rawTotal).toBe(3);
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
    const b = evaluateFans(ctx({ hand: tiles(...TWO_TRIPLETS_HAND) })); // raw 1
    expect(b.rawTotal).toBe(1);
    expect(b.total).toBe(1);
  });

  it("GC-29 raw 低於頂標 1 台: 4台頂標不截斷", () => {
    const b = evaluateFans(ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) })); // raw 3
    expect(b.rawTotal).toBe(3);
    expect(b.total).toBe(3);
  });

  it("GC-30 8台頂標邊界: raw 11 → total 8 (門清+平胡+清一色)", () => {
    const b = evaluateFans(ctx({ hand: tiles(...PURE_ONE_SUIT_HAND) }), 8);
    expect(b.rawTotal).toBe(11);
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
    const c = ctx({ selfDraw: true, hand: tiles(...RUNS_HAND) }); // total 3 (門清一摸三)
    expect(evaluateFans(c).total).toBe(3);
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 900 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -300 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -300 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -300 });
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

  it("GC-35 放槍平胡 (raw 2): 仍為零和", () => {
    const hand = tiles(...RUNS_HAND_OPEN);
    const melds = [chiMeld(1, run("wan", 1))];
    const c = ctx({ hand, melds, discardWin: true, discardWinSeat: 1 });
    expect(evaluateFans(c).total).toBe(2); // 平胡 2
    const ledger = settleLedger(c);
    expect(ledger[0]).toEqual({ seat: 0, delta: 400 }); // 200 + 100 + 100
    expect(ledger[1]).toEqual({ seat: 1, delta: -200 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -100 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -100 });
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

  it("GC-37 奇數底分 pointPerFan=25, 1台: 半額無條件捨去仍零和", () => {
    const c = ctx({
      hand: tiles(...TWO_TRIPLETS_HAND),
      discardWin: true,
      discardWinSeat: 2,
    });
    const ledger = settleLedger(c, 4, 25);
    // total 1 → stake 25; 放槍者 -25, 其餘各 -12; 贏家 +49
    expect(ledger[0]).toEqual({ seat: 0, delta: 49 });
    expect(ledger[1]).toEqual({ seat: 1, delta: -12 });
    expect(ledger[2]).toEqual({ seat: 2, delta: -25 });
    expect(ledger[3]).toEqual({ seat: 3, delta: -12 });
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

// ---------------------------------------------------------------------------
// Extended Taiwan Mahjong Fan Matrix Tests
// ---------------------------------------------------------------------------

describe("evaluateFans — 台灣麻將特殊役與大牌台數", () => {
  beforeEach(() => resetIds());

  it("槓上開花: 門清一摸三3 + 槓上開花1 = 4 台 (8台頂標)", () => {
    const b = evaluateFans(ctx({
      selfDraw: true,
      kongDraw: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "槓上開花", value: 1 });
    expect(b.fans).toContainEqual({ rule: "門清一摸三", value: 3 });
    expect(b.fans.some((f) => f.rule === "自摸")).toBe(false); // 互斥取高
    expect(b.rawTotal).toBe(4);
  });

  it("搶槓: 放槍胡 + 搶槓 + 平胡 = 4 台 (門清1+平胡2+搶槓1)", () => {
    const b = evaluateFans(ctx({
      discardWin: true,
      robbedKong: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "搶槓", value: 1 });
    expect(b.rawTotal).toBe(4);
  });

  it("海底撈月: 門清自摸3 + 海底撈月1 = 4 台", () => {
    const b = evaluateFans(ctx({
      selfDraw: true,
      lastTileDraw: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "海底撈月", value: 1 });
    expect(b.rawTotal).toBe(4);
  });

  it("天胡: 莊家起手自摸天胡 = 24 台 (門清一摸三3+天胡24=27)", () => {
    const b = evaluateFans(ctx({
      winner: 0,
      dealer: 0,
      selfDraw: true,
      tianHu: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "天胡", value: 24 });
    expect(b.rawTotal).toBe(27);
    expect(b.total).toBe(8); // cap at 8
  });

  it("地胡: 閒家第一輪自摸地胡 = 16 台", () => {
    const b = evaluateFans(ctx({
      winner: 1,
      dealer: 0,
      selfDraw: true,
      diHu: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "地胡", value: 16 });
    expect(b.total).toBe(8); // cap at 8
  });

  it("大三元: 中發白皆為刻子 = 8 台", () => {
    const hand = tiles(
      ...triple("honor:zhong"),
      ...triple("honor:fa"),
      ...triple("honor:bai"),
      ...run("wan", 1),
      ...run("wan", 4),
      ...pair("tong:1"),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "大三元", value: 8 });
  });

  it("小三元: 中發白中兩刻一對 = 4 台", () => {
    const hand = tiles(
      ...triple("honor:zhong"),
      ...triple("honor:fa"),
      ...pair("honor:bai"),
      ...run("wan", 1),
      ...run("wan", 4),
      ...run("wan", 7),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "小三元", value: 4 });
  });

  it("大四喜: 東南西北皆為刻子 = 16 台", () => {
    const hand = tiles(
      ...triple("honor:dong"),
      ...triple("honor:nan"),
      ...triple("honor:xi"),
      ...triple("honor:bei"),
      ...run("wan", 1),
      ...pair("tong:9"),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "大四喜", value: 16 });
  });

  it("小四喜: 東南西北中三刻一對 = 8 台", () => {
    const hand = tiles(
      ...triple("honor:dong"),
      ...triple("honor:nan"),
      ...triple("honor:xi"),
      ...pair("honor:bei"),
      ...run("wan", 1),
      ...run("wan", 4),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "小四喜", value: 8 });
  });

  it("字一色: 全部為字牌 = 16 台", () => {
    const hand = tiles(
      ...triple("honor:dong"),
      ...triple("honor:nan"),
      ...triple("honor:xi"),
      ...triple("honor:zhong"),
      ...triple("honor:fa"),
      ...pair("honor:bai"),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "字一色", value: 16 });
  });

  it("花牌: 正花 1 台 (東風位拿春)", () => {
    const b = evaluateFans(ctx({
      winner: 0,
      dealer: 0, // 東風位
      flowers: tiles("flower:chun"),
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "花牌", value: 1 });
  });

  it("花牌: 花槓 2 台 (春夏秋冬集滿)", () => {
    const b = evaluateFans(ctx({
      winner: 0,
      dealer: 0,
      flowers: tiles("flower:chun", "flower:xia", "flower:qiu", "flower:dong"),
      hand: tiles(...RUNS_HAND),
    }), 8);
    // 春 1 台 + 季花槓 2 台 = 3 台
    expect(b.fans).toContainEqual({ rule: "花牌", value: 3 });
  });

  it("花牌: 八仙過海 8 台 (8 張花牌集齊)", () => {
    const b = evaluateFans(ctx({
      winner: 0,
      dealer: 0,
      flowers: tiles(
        "flower:chun", "flower:xia", "flower:qiu", "flower:dong",
        "flower:mei", "flower:lan", "flower:zhu", "flower:ju",
      ),
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "花牌", value: 8 });
  });
});

// ---------------------------------------------------------------------------
// Fan matrix — 平胡 / 全求人 / 邊張 / 坎張 / 單吊 / 三·四·五暗刻 / 河底撈魚
// (整合自參考實作的 Taiwan V1 scoring policy)
// ---------------------------------------------------------------------------

describe("evaluateFans — 平胡 / 等待分析 / 暗刻分級", () => {
  beforeEach(() => resetIds());

  it("平胡: 放槍全順子開放聽 → 2 台 (與清一色疊加為 10)", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("wan", 2), ...run("wan", 5), ...pair("wan:9"),
    );
    const b = evaluateFans(ctx({ hand }), 8);
    expect(b.fans).toContainEqual({ rule: "平胡", value: 2 });
    expect(b.fans).toContainEqual({ rule: "清一色", value: 8 });
    expect(b.rawTotal).toBe(11); // 門清1 + 平胡2 + 清一色8
  });

  it("平胡: 自摸會被排除 (限放槍)", () => {
    const hand = tiles(...RUNS_HAND);
    const b = evaluateFans(ctx({ selfDraw: true, hand }), 8);
    expect(b.fans.some((f) => f.rule === "平胡")).toBe(false);
  });

  it("平胡: 有花牌會被排除", () => {
    const b = evaluateFans(ctx({
      flowers: tiles("flower:chun"),
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans.some((f) => f.rule === "平胡")).toBe(false);
  });

  it("邊張: 放槍、1-2 聽 3 的單聽邊張 → 門清1 + 邊張1 + 無平胡", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...pair("wan:9"),
      ...run("tong", 1), ...run("tong", 4),
    );
    const winningTile = byFaceId(hand, "tong:3"); // completes the 1-2-3 edge
    const b = evaluateFans(ctx({ hand, winningTile, discardWin: true }), 8);
    expect(b.fans).toContainEqual({ rule: "邊張", value: 1 });
    expect(b.fans.some((f) => f.rule === "平胡")).toBe(false); // 邊張排除平胡
    expect(b.fans.some((f) => f.rule === "單吊")).toBe(false);
    expect(b.fans.some((f) => f.rule === "坎張")).toBe(false);
  });

  it("坎張: 放槍、2-4 聽 3 的單聽坎張 → 坎張 1", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...pair("wan:9"),
      "tong:2", "tong:3", "tong:4",
      ...run("tong", 4),
    );
    const winningTile = byFaceId(hand, "tong:3"); // completes the 2-4 closed wait
    const b = evaluateFans(ctx({ hand, winningTile, discardWin: true }), 8);
    expect(b.fans).toContainEqual({ rule: "坎張", value: 1 });
  });

  it("單吊: 放槍、單吊將 → 單吊 1", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...run("tong", 1), ...run("tong", 4),
      "wan:5", "wan:5",
    );
    const winningTile = byFaceIdLast(hand, "wan:5"); // the pair copy completing 單吊
    const b = evaluateFans(ctx({ hand, winningTile, discardWin: true }), 8);
    expect(b.fans).toContainEqual({ rule: "單吊", value: 1 });
  });

  it("南部變體 (south): 邊張/坎張/單吊 不適用", () => {
    const hand = tiles(
      ...run("wan", 1), ...run("wan", 4), ...run("wan", 7),
      ...pair("wan:9"),
      ...run("tong", 1), ...run("tong", 4),
    );
    const winningTile = byFaceId(hand, "tong:3");
    const b = evaluateFans(ctx({ hand, winningTile, discardWin: true, variant: "south" }), 8);
    expect(b.fans.some((f) => f.rule === "邊張")).toBe(false);
    expect(b.fans).toContainEqual({ rule: "平胡", value: 2 }); // south 平胡仍成立
  });

  it("全求人: 4 副露 + 單吊將放槍 → 全求人 2 (取代單吊)", () => {
    const melds = [
      chiMeld(1, run("wan", 1)),
      pengMeld(2, "honor:dong"),
      pengMeld(3, "honor:nan"),
      pengMeld(4, "honor:xi"),
    ];
    const hand = tiles("tong:2", "tong:3", "tong:4", "wan:9", "wan:9");
    const winningTile = hand[hand.length - 1]!; // 單吊將 (wan:9)
    const b = evaluateFans(ctx({ hand, melds, winningTile, discardWin: true }), 8);
    expect(b.fans).toContainEqual({ rule: "全求人", value: 2 });
    expect(b.fans.some((f) => f.rule === "單吊")).toBe(false);
  });

  it("三暗刻: 3 暗刻 + 2 碰 → 三暗刻2 + 碰碰胡4 = 6", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"),
      ...pair("honor:zhong"),
    );
    const melds = [pengMeld(1, "honor:dong"), pengMeld(2, "honor:nan")];
    const b = evaluateFans(ctx({ hand, melds }));
    expect(b.fans).toContainEqual({ rule: "三暗刻", value: 2 });
    expect(b.fans).toContainEqual({ rule: "碰碰胡", value: 4 });
    expect(b.fans.some((f) => f.rule === "四暗刻")).toBe(false);
  });

  it("四暗刻: 4 暗刻 + 1 吃 → 四暗刻5 (不給三暗刻)", () => {
    const hand = tiles(
      ...triple("wan:1"), ...triple("wan:2"), ...triple("tong:9"), ...triple("tong:8"),
      ...pair("honor:zhong"),
    );
    const melds = [chiMeld(1, run("wan", 5))];
    const b = evaluateFans(ctx({ hand, melds }), 8);
    expect(b.fans).toContainEqual({ rule: "四暗刻", value: 5 });
    expect(b.fans.some((f) => f.rule === "三暗刻")).toBe(false);
  });

  it("河底撈魚: 最後一張牌放槍胡 → +1", () => {
    const b = evaluateFans(ctx({
      discardWin: true,
      riverBottomDiscardWin: true,
      hand: tiles(...RUNS_HAND),
    }), 8);
    expect(b.fans).toContainEqual({ rule: "河底撈魚", value: 1 });
    expect(b.fans).toContainEqual({ rule: "平胡", value: 2 });
    expect(b.rawTotal).toBe(4); // 門清1 + 平胡2 + 河底撈魚1
  });
});

