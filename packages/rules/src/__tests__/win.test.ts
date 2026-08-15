/**
 * Win (胡牌) detection unit tests.
 *
 * 合法可胡即自動胡牌: the server detects a legal win (standard 5 melds + pair,
 * or 八對子 seven-pairs) and declares it automatically.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { tiles, resetIds } from "./helpers.js";
import { detectWin } from "../win.js";
import type { TileInstance } from "../tiles.js";
import type { Meld } from "../types.js";

function meld(id: number, ids: string[]): Meld {
  const t = tiles(...ids);
  return {
    id,
    kind: "chi",
    tiles: t,
    claimed: t[2]!,
    handTiles: [t[0]!, t[1]!],
  };
}

describe("detectWin — standard hands", () => {
  beforeEach(() => resetIds());

  it("detects a basic 17-tile winning hand (5 melds + pair)", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3", // meld 1
      "wan:4", "wan:5", "wan:6", // meld 2
      "wan:7", "wan:8", "wan:9", // meld 3
      "tong:1", "tong:2", "tong:3", // meld 4
      "tong:4", "tong:4", // pair
      // hand has 14; add the winning tile as 15th? For a discard win the hand
      // is 16 tiles + the claimed discard = 17. So supply the full 17.
      "tong:5", "tong:6", "tong:7",
    );
    // 17 tiles: melds 1-3 (wan runs) + tong 1,2,3 / 4,4 pair / 5,6,7.
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("detects a concealed hand with honor triplets + numbered runs", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    // 14 + ... this is only 14. For 17 we need 5 groups.
    // Fix: 3 runs (9) + dong triplet (3) + zhong pair (2) = 14 → 4 groups + pair.
    // Add one more meld to reach 5 groups.
    const full = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    expect(full).toHaveLength(17);
    expect(detectWin(full, []).win).toBe(true);
  });

  it("rejects a non-winning hand", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:4",
      "wan:5", "wan:6", "wan:8",
      "wan:9", "tong:1", "tong:2",
      "tong:4", "tong:5", "tong:7",
      "tong:8", "honor:dong", "honor:dong", "honor:dong", "honor:zhong",
    );
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("detects a win with open melds (fewer hand tiles)", () => {
    // 2 open melds (chi) → hand holds 3 melds + pair = 11 tiles.
    const open: Meld[] = [
      meld(1, ["wan:1", "wan:2", "wan:3"]),
      meld(2, ["wan:4", "wan:5", "wan:6"]),
    ];
    const hand = tiles(
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    expect(hand).toHaveLength(11);
    const result = detectWin(hand, open);
    expect(result.win).toBe(true);
  });

  it("rejects a hand with the wrong total tile count", () => {
    const hand = tiles("wan:1", "wan:2", "wan:3", "wan:4");
    expect(detectWin(hand, []).win).toBe(false);
  });
});

describe("detectWin — 八對子 (seven pairs + triplet)", () => {
  beforeEach(() => resetIds());

  it("detects a seven-pairs hand (7 pairs + 1 triplet = 17 tiles)", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:4", "wan:4",
      "wan:5", "wan:5", "wan:6", "wan:6",
      "wan:7", "wan:7", "tong:9", "tong:9", "tong:9",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("sevenPairs");
  });

  it("rejects a hand with 8 distinct pairs (no triplet)", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:4", "wan:4",
      "wan:5", "wan:5", "wan:6", "wan:6",
      "wan:7", "wan:7", "tong:9", "tong:9",
    );
    // Only 16 tiles → not a win.
    expect(detectWin(hand, []).win).toBe(false);
  });
});

describe("detectWin — kong adjustments", () => {
  beforeEach(() => resetIds());

  it("allows 18 tiles when one kong meld is present", () => {
    const kongTiles = tiles("wan:1", "wan:1", "wan:1", "wan:1");
    const kong: Meld = { id: 5, kind: "kong", kongType: "closed", tiles: kongTiles };
    // 1 kong (4 tiles, one group) + 4 more groups + pair = 17 - 4 + 4 + 2... 
    // With a kong: total = 17 + 1 = 18 tiles.
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:8", "tong:9",
      "honor:fa", "honor:fa",
    );
    // 4 runs + pair = 14 hand tiles; 14 + 4 (kong) = 18 = 17 + 1 kong. ✓
    const result = detectWin(hand, [kong]);
    expect(result.win).toBe(true);
  });
});

describe("detectWin — 面子數計算回歸（同數字不誤算）", () => {
  beforeEach(() => resetIds());

  function pengMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid);
    return { id, kind: "peng", tiles: t, claimed: t[0]! };
  }

  function kongMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid, tid);
    return { id, kind: "kong", kongType: "closed", tiles: t };
  }

  it("清一色順子：5 順 + 將 能胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:7",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("全刻子碰碰胡：5 刻 + 將 能胡（同數字面子數不再誤算）", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1",
      "wan:2", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:3",
      "tong:4", "tong:4", "tong:4",
      "tong:5", "tong:5", "tong:5",
      "honor:zhong", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("混一色：萬子順子 + 字牌刻子 + 將 能胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "honor:dong", "honor:dong", "honor:dong",
      "honor:zhong", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    expect(detectWin(hand, []).win).toBe(true);
  });

  it("有副露（1 碰）時仍能胡", () => {
    const open: Meld[] = [pengMeld(1, "honor:dong")];
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:9", "tong:9",
    );
    // 4 面子 + 將 = 14；+ 碰 3 張 = 17。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });

  it("2 槓（各 4 張）後張數 = 19 仍能胡", () => {
    const open: Meld[] = [
      kongMeld(1, "wan:1"),
      kongMeld(2, "tong:1"),
    ];
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "tong:2", "tong:3", "tong:4",
      "tong:5", "tong:6", "tong:7",
      "honor:fa", "honor:fa",
    );
    // 3 面子 + 將 = 11；+ 8（兩槓）= 19 = 17 + 2 槓。
    expect(hand).toHaveLength(11);
    expect(detectWin(hand, open).win).toBe(true);
  });
});

describe("detectWin — 階段 1 補充案例", () => {
  beforeEach(() => resetIds());

  function chiMeld(id: number, ids: string[]): Meld {
    const t = tiles(...ids);
    return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
  }

  it("111 234 同花色（刻 + 順混合）可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1", // 111 刻
      "wan:2", "wan:3", "wan:4", // 234 順
      "wan:5", "wan:6", "wan:7", // 567 順
      "wan:7", "wan:8", "wan:9", // 789 順
      "tong:1", "tong:1", "tong:1", // 111 筒 刻
      "tong:5", "tong:5", // 將
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("字牌三張孤張不能當順（honor 只能成刻）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:1", "tong:1",
      "tong:9", "tong:9",
      "honor:nan", "honor:xi", "honor:zhong",
    );
    expect(hand).toHaveLength(17);
    // 若 honor 可當「順」這裡就胡了；實作 honor 只認 0/3 → 不胡。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("跨花色三張（萬筒條 1）不能當順 不可胡", () => {
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:1", "tiao:2", "tiao:3",
      "wan:1", "tong:1", "tiao:1",
      "wan:9", "wan:9",
    );
    expect(hand).toHaveLength(17);
    // wan:1/tong:1/tiao:1 不同花色不可組順；任何 pair 候選都無法讓剩餘成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("只有對子 + 孤張（沒有面子）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:6",
      "wan:7", "wan:7",
      "wan:8",
      "wan:9", "wan:9",
    );
    expect(hand).toHaveLength(17);
    // 7 對 + 2 孤張：不構成八對子（7對+1刻），標準胡也無面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("完整結構但少一張（16 張）不可胡", () => {
    // 清一色順子 17 張去掉一張（wan:7 將原 pair 剩單張）。
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7",
    );
    expect(hand).toHaveLength(16);
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("重複點數很多的清一色（11122233344455 萬 + 678 順）可胡", () => {
    const hand = tiles(
      "wan:1", "wan:1", "wan:1",
      "wan:2", "wan:2", "wan:2",
      "wan:3", "wan:3", "wan:3",
      "wan:4", "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:7", "wan:8",
    );
    expect(hand).toHaveLength(17);
    // 4 刻（111/222/333/444）+ 55 將 + 678 順：同數字面子數不被 rank 數誤算。
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("已吃 1 組 + 手上 4 面子 + 將 可胡", () => {
    const open: Meld[] = [chiMeld(1, ["wan:1", "wan:2", "wan:3"])];
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
    );
    // 4 面子 + 將 = 14；+ 吃 3 張 = 17。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });
});

describe("detectWin — 過夜補充案例", () => {
  beforeEach(() => resetIds());

  function pengMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid);
    return { id, kind: "peng", tiles: t, claimed: t[0]! };
  }

  function kongMeld(id: number, tid: string): Meld {
    const t = tiles(tid, tid, tid, tid);
    return { id, kind: "kong", kongType: "closed", tiles: t };
  }

  function chiMeld(id: number, ids: string[]): Meld {
    const t = tiles(...ids);
    return { id, kind: "chi", tiles: t, claimed: t[2]!, handTiles: [t[0]!, t[1]!] };
  }

  it("[不胡] 八對子型態但有副露（7 對手牌 + 1 碰）不可胡", () => {
    const open: Meld[] = [pengMeld(1, "honor:dong")];
    const hand = tiles(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "tong:9", "tong:9",
      "honor:fa", "honor:fa",
    );
    expect(hand).toHaveLength(14);
    // 14 + 碰 3 = 17 總張：八對子要求無副露 → 被擋；標準胡 7 對無面子 → 不胡。
    expect(detectWin(hand, open).win).toBe(false);
  });

  it("[不胡] 4 對 + 3 順 17 張（對子過多湊不成面子）不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:1",
      "tong:2", "tong:2",
      "tong:4", "tong:4",
      "tong:5", "tong:5",
    );
    expect(hand).toHaveLength(17);
    // 任一對取下後剩 3 對 + 3 順 = 15 張卻只有 3 面目可辨 → 無法成 5 面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 1 槓 18 張但手牌面子不齊不可胡", () => {
    const open: Meld[] = [kongMeld(1, "wan:1")];
    const hand = tiles(
      "wan:2", "wan:3", "wan:4",
      "wan:5", "wan:6", "wan:7",
      "tong:1", "tong:2", "tong:4",
      "tong:5", "tong:7",
      "honor:zhong", "honor:zhong", "honor:zhong",
    );
    // 14 + 4（槓）= 18 總張正確，但 tong 缺 3/6 斷張、面子湊不齊。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(false);
  });

  it("[不胡] 字牌兩張將但數牌斷張不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:4",
      "wan:5", "wan:6", "wan:8",
      "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "honor:zhong", "honor:zhong",
      "tiao:7", "tiao:9",
    );
    expect(hand).toHaveLength(17);
    // 中將 2 張當將後，萬子 1,2,4 / 5,6,8 斷張不成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[不胡] 萬 12345689 斷張 + 筒 123 + 將 17 張不可胡", () => {
    const hand = tiles(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7", "tong:7",
      "tiao:1",
    );
    expect(hand).toHaveLength(17);
    // wan 缺 7 斷張；tiao:1 孤張當不成面子。
    expect(detectWin(hand, []).win).toBe(false);
  });

  it("[可胡] 全字牌碰碰胡（5 刻 + 將 17 張）可胡", () => {
    const hand = tiles(
      "honor:dong", "honor:dong", "honor:dong",
      "honor:nan", "honor:nan", "honor:nan",
      "honor:xi", "honor:xi", "honor:xi",
      "honor:bei", "honor:bei", "honor:bei",
      "honor:zhong", "honor:zhong", "honor:zhong",
      "honor:fa", "honor:fa",
    );
    expect(hand).toHaveLength(17);
    const result = detectWin(hand, []);
    expect(result.win).toBe(true);
    expect(result.kind).toBe("standard");
  });

  it("[可胡] 1 吃 + 1 碰 兩組副露 + 手牌 11 張可胡", () => {
    const open: Meld[] = [
      chiMeld(1, ["wan:1", "wan:2", "wan:3"]),
      pengMeld(2, "honor:dong"),
    ];
    const hand = tiles(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:7", "tong:7",
    );
    // 3 面子 + 將 = 11；+ 吃 3 + 碰 3 = 17 總張。
    expect(hand).toHaveLength(11);
    expect(detectWin(hand, open).win).toBe(true);
  });

  it("[可胡] 1 槓 + 3 刻 1 順 1 將 18 張可胡", () => {
    const open: Meld[] = [kongMeld(1, "wan:1")];
    const hand = tiles(
      "wan:5", "wan:6", "wan:7",
      "wan:2", "wan:2", "wan:2",
      "tong:4", "tong:4", "tong:4",
      "tong:9", "tong:9", "tong:9",
      "honor:zhong", "honor:zhong",
    );
    // 1 順 + 3 刻 + 將 = 14；+ 4（槓）= 18 總張。
    expect(hand).toHaveLength(14);
    expect(detectWin(hand, open).win).toBe(true);
  });
});
