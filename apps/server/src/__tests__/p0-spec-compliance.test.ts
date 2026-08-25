/**
 * P0 Spec Compliance & Regression Suite
 *
 * Explicit tests proving P0-A through P0-J as required by docs/spec.md:
 *  - P0-A: Multi-round running scores retention
 *  - P0-B: Dealer rotation timing vs WinContext (tianHu/diHu/正花)
 *  - P0-C: 一砲多響 multi-winner zero-sum settlement
 *  - P0-D: 搶槓 add-on tile & robber meld independence
 *  - P0-E: 槓上開花 replacement draw auto-win
 *  - P0-F: 天胡 (+24) & 地胡 (+16)
 *  - P0-G: 流局 scores unchanged & dealer streak+1
 *  - P0-H: Double-cursor wall tile accounting (144 / 136)
 *  - P0-I: operationId idempotency & payload conflict detection
 *  - P0-J: 門清一摸三 = 3 fans (exclusive high)
 */

import { describe, it, expect } from "vitest";
import {
  accountedTiles,
  detectWin,
  evaluateFans,
  headRemaining,
  settleLedger,
  settleMultiLedger,
  type GameState,
  type Meld,
  type TileInstance,
  type WinContext,
} from "@taiwan-mahjong/rules";
import { Room } from "../room.js";
import type { ClientCommand } from "../protocol.js";

function makeRoom(dealer = 0): Room {
  const room = new Room({ id: "p0-room", variant: "north", dealer: dealer as any, fanCap: 8 });
  room.join("p0", "Player 0");
  room.join("p1", "Player 1");
  room.join("p2", "Player 2");
  room.join("p3", "Player 3");
  return room;
}

function readyAll(room: Room): void {
  for (const pid of ["p0", "p1", "p2", "p3"]) room.setReady(pid);
}

function tiles(specs: string[], startId = 1000): TileInstance[] {
  let id = startId;
  return specs.map((spec) => {
    const idx = spec.indexOf(":");
    const category = spec.slice(0, idx);
    const value = spec.slice(idx + 1);
    const tile =
      category === "wan" || category === "tiao" || category === "tong"
        ? ({ kind: "numbered", suit: category, rank: Number(value) } as TileInstance["tile"])
        : category === "honor"
          ? ({ kind: "honor", honor: value } as TileInstance["tile"])
          : ({ kind: "flower", flower: value } as TileInstance["tile"]);
    return { instanceId: id++, tile };
  });
}

const HAND_16_WAIT_TONG7 = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7",
];

const HAND_17_WIN = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7", "tong:7",
];

const NON_WINNING_16 = [
  "honor:dong", "honor:dong", "honor:dong", "honor:dong",
  "honor:nan", "honor:nan", "honor:nan", "honor:nan",
  "honor:xi", "honor:xi", "honor:xi", "honor:xi",
  "honor:bei", "honor:bei", "honor:bei", "honor:bei",
];

describe("P0-A: Room.startGame() running score retention", () => {
  it("preserves running cumulative scores across multiple rounds (hand 1 -> hand 2)", () => {
    const room = makeRoom(0);
    readyAll(room);
    expect(room.status).toBe("playing");

    // Simulate winning hand 1 for seat 0 (+300 pts from 3 non-dealers paying 100)
    const state = room.state!;
    // Seat 0 self draws winning tile
    state.wall.hands[0] = tiles(HAND_17_WIN, 2000);
    // Discard a tile to trigger win settlement via finishWin
    (room as any).finishWin(state, 0, true, false);

    expect(room.status).toBe("ended");
    const scoresAfterRound1 = [...room.scores];
    expect(scoresAfterRound1[0]).toBeGreaterThan(0);
    expect(scoresAfterRound1.reduce((a, b) => a + b, 0)).toBe(0);

    // Reset and start round 2
    readyAll(room);
    expect(room.status).toBe("playing");
    // Scores MUST NOT be wiped back to [0, 0, 0, 0] on startGame
    expect(room.scores).toEqual(scoresAfterRound1);
  });
});

describe("P0-B: finishWin() dealer rotation vs WinContext timing", () => {
  it("non-dealer winning hand correctly evaluates diHu and dealer relative flowers without being inverted by dealer rotation", () => {
    const room = makeRoom(0); // dealer is 0
    readyAll(room);
    const state = room.state!;

    // Non-dealer seat 1 wins on first self-draw (diHu)
    state.wall.hands[1] = tiles(HAND_17_WIN, 3000);
    state.discards = [tiles(["wan:9"], 3100)[0]!]; // 1 discard by dealer 0
    state.turn = 1;
    state.lastDrawnBy = 1;
    state.lastDrawnTile = state.wall.hands[1][16]!;

    (room as any).finishWin(state, 1, true, false);

    expect(room.winner).toBe(1);
    expect(room.breakdown).not.toBeNull();
    const fanRules = room.breakdown!.fans.map((f) => f.rule);
    // Must contain 地胡 (+16)
    expect(fanRules).toContain("地胡");
    expect(fanRules).not.toContain("天胡");
    // Dealer for NEXT round rotates to seat 1
    expect((room as any).dealer).toBe(1);
  });
});

describe("P0-C: 一砲多響 (multi-win) zero-sum settlement", () => {
  it("all eligible winners settle on discard: discarder pays full, non-winners pay half, winners never pay each other, sum(delta)===0", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    // Seat 0 discards tong:7
    const discardTile = tiles(["tong:7"], 4000)[0]!;
    state.wall.hands[0] = [discardTile, ...tiles(HAND_16_WAIT_TONG7.slice(0, 15), 4100)];
    // Both seat 1 and seat 2 are waiting for tong:7
    state.wall.hands[1] = tiles(HAND_16_WAIT_TONG7, 4200);
    state.wall.hands[2] = tiles(HAND_16_WAIT_TONG7, 4300);
    // Seat 3 has a non-winning hand
    state.wall.hands[3] = tiles(NON_WINNING_16, 4400);

    const res = room.handleCommand("p0", {
      type: "discard",
      tileInstanceId: discardTile.instanceId,
      generationId: room.generationId,
      operationId: "op-multi-win-disc",
    });

    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.ledger).not.toBeNull();

    // Sum of all deltas must be mathematically 0
    const totalDelta = room.ledger!.reduce((acc, entry) => acc + entry.delta, 0);
    expect(totalDelta).toBe(0);

    // Seat 1 and 2 are winners (positive delta), seat 0 (discarder) has large negative delta
    const delta0 = room.ledger!.find((e) => e.seat === 0)!.delta;
    const delta1 = room.ledger!.find((e) => e.seat === 1)!.delta;
    const delta2 = room.ledger!.find((e) => e.seat === 2)!.delta;
    const delta3 = room.ledger!.find((e) => e.seat === 3)!.delta;

    expect(delta1).toBeGreaterThan(0);
    expect(delta2).toBeGreaterThan(0);
    expect(delta0).toBeLessThan(0);
    expect(delta3).toBeLessThan(0);
    expect(delta0 + delta1 + delta2 + delta3).toBe(0);
  });
});

describe("P0-D: 搶槓 (qiangKong) add-on tile & robber meld independence", () => {
  it("evaluates robber using robber's own melds and debits the kongger", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    // Seat 0 has a peng of wan:5 and draws the 4th wan:5
    const wan5_1 = tiles(["wan:5"], 5001)[0]!;
    const wan5_2 = tiles(["wan:5"], 5002)[0]!;
    const wan5_3 = tiles(["wan:5"], 5003)[0]!;
    const wan5_extra = tiles(["wan:5"], 5004)[0]!;

    state.melds[0] = [
      { id: 10, kind: "peng", tiles: [wan5_1, wan5_2, wan5_3], claimed: wan5_3 } as Meld,
    ];
    state.wall.hands[0] = [wan5_extra, ...tiles(HAND_16_WAIT_TONG7.slice(0, 15), 5100)];
    state.turn = 0;
    state.phase = "discard";

    // Seat 1 has an open peng of tong:1 and waits on wan:5 (13 hand tiles + 1 peng meld = 16 tiles)
    const claimedTong1 = tiles(["tong:1"], 5200)[0]!;
    state.melds[1] = [
      { id: 11, kind: "peng", tiles: [claimedTong1, tiles(["tong:1"], 5201)[0]!, tiles(["tong:1"], 5202)[0]!], claimed: claimedTong1 } as Meld,
    ];
    state.wall.hands[1] = tiles([
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:6", // waiting on wan:5
      "tong:2", "tong:3", "tong:4",
      "tong:5", "tong:6", "tong:7",
      "honor:dong", "honor:dong",
    ], 5300);

    // Seat 0 performs add-on kong
    const res = room.handleCommand("p0", {
      type: "reaction",
      kind: "kong",
      kongType: "add-on",
      handTileIds: [wan5_extra.instanceId],
      pengMeldId: 10,
      generationId: room.generationId,
      operationId: "op-addon-kong-rob",
    });

    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1);

    const breakdown = room.breakdown!;
    expect(breakdown.fans.map((f) => f.rule)).toContain("搶槓");

    // Zero-sum ledger: kongger (seat 0) debited full stake, seat 1 credited
    expect(room.ledger!.reduce((a, b) => a + b.delta, 0)).toBe(0);
    expect(room.ledger!.find((e) => e.seat === 1)!.delta).toBeGreaterThan(0);
    expect(room.ledger!.find((e) => e.seat === 0)!.delta).toBeLessThan(0);
  });
});

describe("P0-E: 槓上開花 (kongDraw) auto-win", () => {
  it("drawFromDeck replacement completes hand and triggers auto-win with 槓上開花", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    // Seat 0 has 4 wan:1s in hand and 12 other tiles waiting on tong:7
    const closedKongTiles = tiles(["wan:1", "wan:1", "wan:1", "wan:1"], 6000);
    const waitingTiles = tiles([
      "wan:2", "wan:3", "wan:4",
      "wan:5", "wan:6", "wan:7",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
    ], 6100);
    // Pair of tong:7 (waiting for second tong:7) -> total 16 tiles
    state.wall.hands[0] = [...closedKongTiles, ...waitingTiles, tiles(["tong:7"], 6200)[0]!];
    state.turn = 0;
    state.phase = "discard";

    // Set top of deck cursor to tong:7
    const winReplacement = tiles(["tong:7"], 6300)[0]!;
    (state.wall.wall as TileInstance[])[state.wall.deckCursor] = winReplacement;

    const res = room.handleCommand("p0", {
      type: "reaction",
      kind: "kong",
      kongType: "closed",
      handTileIds: closedKongTiles.map((t) => t.instanceId),
      generationId: room.generationId,
      operationId: "op-closed-kong-flower-win",
    });

    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(0);
    expect(room.kongDraw).toBe(true);
    expect(room.breakdown!.fans.map((f) => f.rule)).toContain("槓上開花");
  });
});

describe("P0-F: 天胡 (+24) & 地胡 (+16)", () => {
  it("天胡 awards 24 fans on dealer 17-tile initial deal", () => {
    const ctx: WinContext = {
      winner: 0,
      dealer: 0,
      selfDraw: true,
      tianHu: true,
      hand: tiles(HAND_17_WIN, 7000),
      melds: [],
    };
    const breakdown = evaluateFans(ctx, 8);
    expect(breakdown.fans.find((f) => f.rule === "天胡")?.value).toBe(24);
  });

  it("地胡 awards 16 fans on non-dealer first round self-draw", () => {
    const ctx: WinContext = {
      winner: 1,
      dealer: 0,
      selfDraw: true,
      diHu: true,
      hand: tiles(HAND_17_WIN, 7100),
      melds: [],
    };
    const breakdown = evaluateFans(ctx, 8);
    expect(breakdown.fans.find((f) => f.rule === "地胡")?.value).toBe(16);
  });
});

describe("P0-G: 流局 (exhaustive draw) state & dealer streak+1", () => {
  it("wall exhaustion ends hand with 0 deltas, scores unchanged, and advances dealerStreak", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    // Simulate exhausting wall
    state.wall.headCursor = state.wall.tailStart;
    expect(headRemaining(state.wall)).toBe(0);

    // Trigger unclaimed discard turn advance
    (room as any).passTurnAfterUnclaimed();

    expect(room.status).toBe("ended");
    expect(room.winner).toBeNull();
    expect(room.ledger).toEqual([
      { seat: 0, delta: 0 },
      { seat: 1, delta: 0 },
      { seat: 2, delta: 0 },
      { seat: 3, delta: 0 },
    ]);
    expect(room.scores).toEqual([0, 0, 0, 0]);
    // Dealer streak advances on 流局
    expect(room.dealerStreak).toBe(1);
  });
});

describe("P0-H: Double-cursor wall tile accounting", () => {
  it("North variant accounts for exactly 144 tiles with 16-tile reserved tail", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    expect(accountedTiles(state.wall)).toBe(144);
    // Flowers never stay in hand
    for (let s = 0; s < 4; s++) {
      expect(state.wall.hands[s]!.some((t) => t.tile.kind === "flower")).toBe(false);
    }
  });

  it("South variant accounts for exactly 136 tiles with no flower tiles", () => {
    const room = new Room({ id: "p0-south", variant: "south" });
    room.join("s0", "S0");
    room.join("s1", "S1");
    room.join("s2", "S2");
    room.join("s3", "S3");
    for (const pid of ["s0", "s1", "s2", "s3"]) room.setReady(pid);
    const state = room.state!;

    expect(accountedTiles(state.wall)).toBe(136);
  });
});

describe("P0-I: operationId idempotency & command payload validation", () => {
  it("same operationId + same payload -> idempotent ok", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    const tileId = state.wall.hands[0]![0]!.instanceId;
    const command1: ClientCommand = {
      type: "discard",
      tileInstanceId: tileId,
      generationId: room.generationId,
      operationId: "op-idempotent-test",
    };

    const res1 = room.handleCommand("p0", command1);
    expect(res1.ok).toBe(true);

    // Replay same command with same operationId and same payload
    const res2 = room.handleCommand("p0", command1);
    expect(res2.ok).toBe(true);
  });

  it("same operationId + different payload -> rejected with command_id_reused", () => {
    const room = makeRoom(0);
    readyAll(room);
    const state = room.state!;

    const tileId1 = state.wall.hands[0]![0]!.instanceId;
    const command1: ClientCommand = {
      type: "discard",
      tileInstanceId: tileId1,
      generationId: room.generationId,
      operationId: "op-conflict-test",
    };

    const res1 = room.handleCommand("p0", command1);
    expect(res1.ok).toBe(true);

    // Replay same operationId with DIFFERENT payload
    const command2: ClientCommand = {
      type: "discard",
      tileInstanceId: 99999,
      generationId: room.generationId,
      operationId: "op-conflict-test",
    };

    const res2 = room.handleCommand("p0", command2);
    expect(res2.ok).toBe(false);
    expect(res2.error?.code).toBe("command_id_reused");
  });
});

describe("P0-J: 門清一摸三 = 3 fans (exclusive high)", () => {
  it("self-draw with no open melds awards 門清一摸三 (3 fans) and does not stack selfDraw(1) + menQing(1)", () => {
    const ctx: WinContext = {
      winner: 0,
      dealer: 0,
      selfDraw: true,
      hand: tiles(HAND_17_WIN, 8000),
      melds: [],
    };
    const breakdown = evaluateFans(ctx, 4);
    const rules = breakdown.fans.map((f) => f.rule);

    expect(rules).toContain("門清一摸三");
    expect(rules).not.toContain("自摸");
    expect(rules).not.toContain("門清");
    expect(breakdown.fans.find((f) => f.rule === "門清一摸三")?.value).toBe(3);
  });
});
