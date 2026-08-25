import { describe, expect, it } from "vitest";
import { calculateShanten, calculateTileAcceptance } from "../aiPlayer.js";
import type { TileInstance, Meld } from "@taiwan-mahjong/rules";

let nextInstId = 1;
function t(id: string): TileInstance {
  const [cat, val] = id.split(":");
  if (cat === "honor") {
    return { tile: { kind: "honor", honor: val as "dong" }, instanceId: nextInstId++ };
  }
  return {
    tile: { kind: "numbered", suit: cat as "wan", rank: Number(val) as 1 },
    instanceId: nextInstId++,
  };
}

function handOf(...ids: string[]): TileInstance[] {
  return ids.map((id) => t(id));
}

describe("aiPlayer — 向聽數 (Shanten) 與 牌效 (Tile Acceptance)", () => {
  it("和牌 (Win / -1-Shanten): 5 面子 + 1 雀頭 (17張)", () => {
    const hand = handOf(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:1", "tiao:2", "tiao:3",
      "honor:zhong", "honor:zhong",
    );
    expect(calculateShanten(hand, [])).toBe(-1);
  });

  it("聽牌 (Tenpai / 0-Shanten): 4 面子 + 1 雀頭 + 1 兩面搭子 (16張)", () => {
    const hand = handOf(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:2", "tiao:3", // 兩面搭子 (聽 1, 4 條)
      "honor:zhong", "honor:zhong", // 雀頭
    );
    expect(calculateShanten(hand, [])).toBe(0);

    const ukeire = calculateTileAcceptance(hand, []);
    expect(ukeire.shanten).toBe(0);
    expect(ukeire.improvingTiles).toContain("tiao:1");
    expect(ukeire.improvingTiles).toContain("tiao:4");
  });

  it("一向聽 (1-Shanten): 3 面子 + 1 雀頭 + 2 搭子 (16張)", () => {
    const hand = handOf(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:2", "tong:3", // 搭子 1
      "tiao:4", "tiao:5", // 搭子 2
      "honor:zhong", "honor:zhong", // 雀頭
      "tong:8", "tong:8", // 搭子/對子
    );
    expect(calculateShanten(hand, [])).toBe(1);
  });

  it("八對半 (8-Pairs / 嚦咕嚦咕) 聽牌 (0-Shanten)", () => {
    const hand = handOf(
      "wan:1", "wan:1",
      "wan:2", "wan:2",
      "wan:3", "wan:3",
      "wan:4", "wan:4",
      "wan:5", "wan:5",
      "wan:6", "wan:6",
      "wan:7", "wan:7",
      "tong:9", "tong:9", // 8 pairs = 16 tiles (聽任何一張組成刻子)
    );
    expect(calculateShanten(hand, [])).toBe(0);
  });

  it("含副露 (Open Melds) 時正確計算向聽數", () => {
    const meldTiles = handOf("wan:1", "wan:2", "wan:3");
    const openMeld: Meld = {
      id: 1,
      kind: "chi",
      tiles: meldTiles,
      claimed: meldTiles[0]!,
      handTiles: [meldTiles[1]!, meldTiles[2]!],
    };
    // 剩餘 13 張手牌需湊 4 面子 + 1 雀頭
    const hand = handOf(
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:2", "tiao:3", // 搭子
      "honor:zhong", "honor:zhong", // 雀頭
    );
    expect(calculateShanten(hand, [openMeld])).toBe(0); // 聽 1, 4 條
  });

  it("decideDiscard: 高級 AI 優先打掉孤張並保留聽牌面子", async () => {
    // We can simulate decideDiscard with a mock room
    const testHand = handOf(
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tiao:2", "tiao:3", // 兩面聽 1, 4 條
      "honor:zhong", "honor:zhong", // 將牌
      "tong:9", // 唯一孤張 (第 17 張)
    );
    const mockRoom: any = {
      state: {
        phase: "discard",
        turn: 0,
        wall: {
          hands: [testHand, [], [], []],
          wall: new Array(50).fill({ instanceId: 0, tile: { kind: "numbered", suit: "wan", rank: 1 } }),
          deckCursor: 0,
          headCursor: 0,
          tailCursor: 0,
        },
        melds: [[], [], [], []],
        discards: [[], [], [], []],
      },
    };

    const { decideDiscard } = await import("../aiPlayer.js");
    const decision = decideDiscard(mockRoom, 0, "hard");
    expect(decision).not.toBeNull();
    // Discard should target the isolated tong:9
    const discarded = testHand.find((h) => h.instanceId === decision!.tileInstanceId);
    expect(discarded?.tile).toEqual({ kind: "numbered", suit: "tong", rank: 9 });
  });
});
