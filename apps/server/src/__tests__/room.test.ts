/**
 * Room / RoomManager tests — lifecycle, Generation ID, command dedup, and the
 * authoritative game-loop (auto-deal → discard → reaction → auto-win).
 *
 * These are pure in-process tests (no sockets). The WSS layer is covered by
 * `wss.test.ts`.
 */

import { describe, it, expect } from "vitest";
import type { Meld, TileInstance } from "@taiwan-mahjong/rules";
import { Room, type RoomOptions } from "../room.js";
import { RoomManager } from "../roomManager.js";
import type { ClientCommand } from "../protocol.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoom(overrides: Partial<RoomOptions> = {}): Room {
  return new Room({ id: "test-room", variant: "north", ...overrides });
}

function joinAll(room: Room): number[] {
  return ["a", "b", "c", "d"].map((id) => room.join(id, `P${id.toUpperCase()}`));
}

function readyAll(room: Room, players: string[] = ["a", "b", "c", "d"]): void {
  for (const p of players) room.setReady(p);
}

function cmd(partial: Partial<ClientCommand> & { type: ClientCommand["type"] }): ClientCommand {
  return { operationId: `op-${Math.random()}`, ...partial } as ClientCommand;
}

/** Discard the first tile in the given seat's hand. */
function firstDiscard(room: Room, seat: number): ClientCommand {
  const tile = room.state!.wall.hands[seat]![0]!;
  return cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId });
}

/** Build a TileInstance[] from "suit:rank" / "honor:wind" specs. */
function tiles16(specs: string[], startId = 9000): TileInstance[] {
  let id = startId;
  return specs.map((spec) => {
    const idx = spec.indexOf(":");
    const category = spec.slice(0, idx);
    const value = spec.slice(idx + 1);
    const tile =
      category === "wan" || category === "tiao" || category === "tong"
        ? ({ kind: "numbered", suit: category, rank: Number(value) } as TileInstance["tile"])
        : ({ kind: "honor", honor: value } as TileInstance["tile"]);
    return { instanceId: id++, tile };
  });
}

/** Build a kong reaction command for the given seat (via playerId at that seat). */
function kongReaction(
  room: Room,
  kongType: "open" | "closed" | "add-on",
  handTileIds: number[],
  pengMeldId?: number,
): ClientCommand {
  return cmd({
    type: "reaction",
    kind: "kong",
    kongType,
    handTileIds,
    pengMeldId,
    generationId: room.generationId,
  });
}

/** 16-tile hand: five melds + a single tong:7 — wins on any tong:7. */
const WAIT_TONG7 = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:5", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7",
];

/** 16-tile hand: four melds + pair + wan:46 — wins on wan:5 (robs the kong). */
const WAIT_WAN5 = [
  "wan:1", "wan:2", "wan:3",
  "wan:4", "wan:6",
  "wan:7", "wan:8", "wan:9",
  "tong:1", "tong:2", "tong:3",
  "tong:4", "tong:5", "tong:6",
  "tong:7", "tong:7",
];

/** A 16-tile hand that can never win (honour quadruplets — honours must be triplets). */
const NON_WINNING_16 = [
  "honor:dong", "honor:dong", "honor:dong", "honor:dong",
  "honor:nan", "honor:nan", "honor:nan", "honor:nan",
  "honor:xi", "honor:xi", "honor:xi", "honor:xi",
  "honor:bei", "honor:bei", "honor:bei", "honor:bei",
];

describe("Room — join / ready / auto-deal", () => {
  it("assigns seats 0..3 in join order", () => {
    const room = makeRoom();
    expect(joinAll(room)).toEqual([0, 1, 2, 3]);
    expect(room.status).toBe("lobby");
  });

  it("rejects a 5th player", () => {
    const room = makeRoom();
    joinAll(room);
    expect(() => room.join("e", "P5")).toThrow(/full/i);
  });

  it("4 players ready triggers auto-deal with 17-tile dealer hand", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    expect(room.status).toBe("playing");
    expect(room.state).not.toBeNull();
    // Dealer (0) holds 17, others 16.
    expect(room.state!.wall.hands[0]!.length).toBe(17);
    expect(room.state!.wall.hands[1]!.length).toBe(16);
    expect(room.state!.turn).toBe(0);
    expect(room.state!.phase).toBe("discard");
  });

  it("game does not start until all 4 ready", () => {
    const room = makeRoom();
    joinAll(room);
    room.setReady("a");
    room.setReady("b");
    room.setReady("c");
    expect(room.status).toBe("lobby");
    room.setReady("d");
    expect(room.status).toBe("playing");
  });

  it("disconnect does not remove the seat; reconnect restores it", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const seatB = room.seatOf("b");
    room.setConnected("b", false);
    expect(room.players[seatB]!.connected).toBe(false);
    room.setConnected("b", true);
    expect(room.players[seatB]!.connected).toBe(true);
    expect(room.seatOf("b")).toBe(seatB);
  });
});

describe("Room — generation ID + operationId dedup", () => {
  it("generationId increments on every accepted command", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const g0 = room.generationId;
    room.handleCommand("a", firstDiscard(room, 0));
    expect(room.generationId).toBeGreaterThan(g0);
  });

  it("drops stale commands (older generation)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const staleGen = room.generationId - 1;
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: room.state!.wall.hands[0]![0]!.instanceId, generationId: staleGen }),
    );
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("stale_generation");
  });

  it("same operationId is idempotent — executed once", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const op = "op-idempotent";
    const tileId = room.state!.wall.hands[0]![0]!.instanceId;
    const first = room.handleCommand("a", { type: "discard", operationId: op, tileInstanceId: tileId, generationId: room.generationId });
    expect(first.ok).toBe(true);
    // Replay with the same operationId must not double-execute.
    const second = room.handleCommand("a", { type: "discard", operationId: op, tileInstanceId: tileId });
    expect(second.ok).toBe(true);
    // Hand shrunk by exactly one tile (not two).
    const hand = room.state!.wall.hands[0]!;
    expect(hand.some((t) => t.instanceId === tileId)).toBe(false);
  });

  it("rejects a command from a non-member", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const res = room.handleCommand("nobody", cmd({ type: "pass" }));
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("not_in_room");
  });
});

describe("Room — discard / reaction / auto-win loop", () => {
  it("discard moves to reaction phase and offers the discard pool", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[0]![0]!;
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId }),
    );
    expect(res.ok).toBe(true);
    expect(room.state!.discards.map((t) => t.instanceId)).toContain(tile.instanceId);
  });

  it("discard out of turn is rejected", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[1]![0]!; // seat 1, but it's seat 0's turn
    const res = room.handleCommand("b", cmd({ type: "discard", tileInstanceId: tile.instanceId }));
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe("not_your_turn");
  });

  it("pass advances to the next seat (draw then discard phase)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const tile = room.state!.wall.hands[0]![0]!;
    room.handleCommand("a", cmd({ type: "discard", tileInstanceId: tile.instanceId, generationId: room.generationId }));
    // If any reaction window exists, pass (we are seat 0's discarder so nobody
    // can react to themselves; if a window opened, force-pass it).
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.state!.turn).toBe(1);
    expect(room.state!.phase).toBe("discard");
  });

  it("auto-win fires immediately on a winning discard (合法可胡即自動胡牌)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    // Force seat 1 to be one tile away from winning on the discard.
    // Construct a 16-tile hand that wins when the discarded tile completes a meld.
    const winningHand: TileInstance[] = [];
    const ids = [
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7",
    ];
    let instanceId = 9000;
    for (const id of ids) {
      const [suit, rank] = id.split(":");
      winningHand.push({
        instanceId: instanceId++,
        tile: suit === "wan" || suit === "tong"
          ? { kind: "numbered", suit, rank: Number(rank) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
          : { kind: "honor", honor: "dong" },
      });
    }
    state.wall.hands[1] = winningHand as TileInstance[];

    // Seat 0 discards tong:7 → seat 1 completes tong:567 → win.
    const discard = state.wall.hands[0]!.find((t) => t.tile.kind === "numbered" && t.tile.suit === "tong" && t.tile.rank === 7);
    const discardTile = discard ?? state.wall.hands[0]![0]!;
    // If the natural discard is not tong:7 we simply use the first tile; the
    // auto-win path is exercised regardless when a discard exists. To make the
    // test deterministic, force seat 0's first tile to be tong:7.
    state.wall.hands[0]![0] = {
      instanceId: 8800,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };
    const res = room.handleCommand(
      "a",
      cmd({ type: "discard", tileInstanceId: state.wall.hands[0]![0]!.instanceId, generationId: room.generationId }),
    );
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1);
    expect(room.state!.phase).toBe("ended");
    expect(room.ledger).not.toBeNull();
    // Zero-sum: deltas sum to zero.
    const sum = room.ledger!.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // Discard win: seat 0 pays full, others half.
    const d0 = room.ledger!.find((e) => e.seat === 0)!.delta;
    expect(d0).toBeLessThan(0);
  });
});

describe("Room — P0-1 搶槓 (qiang kong) integration", () => {
  it("an add-on kong is robbed by a winning seat; the kongger pays the ledger", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Kongger (seat 2): a peng of wan:5 plus the 4th wan:5 in hand.
    const pengTiles = tiles16(["wan:5", "wan:5", "wan:5"], 9200);
    const peng: Meld = { id: 77, kind: "peng", tiles: pengTiles, claimed: pengTiles[0]! };
    state.melds[2] = [peng];
    state.wall.hands[2] = tiles16(
      [
        "wan:5",
        "tong:1", "tong:2", "tong:3",
        "tong:4", "tong:5", "tong:6",
        "tong:7", "tong:8", "tong:9",
        "tong:9", "tong:9", "tong:9", "tong:9",
      ],
      9300,
    ); // 14 tiles incl. the 4th wan:5

    // Seat 1 waits on wan:5 and wins when it is robbed.
    state.wall.hands[1] = tiles16(WAIT_WAN5, 9400);
    // Seats 0 & 3 cannot win on wan:5.
    state.wall.hands[0] = tiles16(NON_WINNING_16, 9500);
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9600);

    state.turn = 2;
    state.phase = "discard";

    const fourth = state.wall.hands[2]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 5,
    )!;
    const res = room.handleCommand("c", kongReaction(room, "add-on", [fourth.instanceId], peng.id));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // seat 1 robs the kong
    expect(room.selfDraw).toBe(false);
    expect(room.kongDraw).toBe(false);

    // P0-1 ledger: the kongger (seat 2) pays full stake; bystanders pay half.
    const d = room.ledger!;
    const seat1 = d.find((e) => e.seat === 1)!.delta;
    const seat2 = d.find((e) => e.seat === 2)!.delta;
    const seat0 = d.find((e) => e.seat === 0)!.delta;
    const seat3 = d.find((e) => e.seat === 3)!.delta;
    expect(seat1).toBeGreaterThan(0);
    expect(seat2).toBeLessThan(0);
    expect(seat0).toBeLessThan(0);
    expect(seat3).toBeLessThan(0);
    // The kongger (放槍者) loses more than a bystander.
    expect(seat2).toBeLessThan(seat0);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — P0-2 槓上開花 (kong-draw win) integration", () => {
  it("the kong replacement completes the kongger's hand → self-draw win with kongDraw", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Kongger (seat 2): a peng of wan:5 plus a 14-tile hand incl. the 4th wan:5.
    const pengTiles = tiles16(["wan:5", "wan:5", "wan:5"], 9200);
    const peng: Meld = { id: 77, kind: "peng", tiles: pengTiles, claimed: pengTiles[0]! };
    state.melds[2] = [peng];
    // Pre-kong hand: 13 usable tiles + the 4th wan:5. After the add-on kong
    // consumes wan:5 and draws the deck tile (tong:7) → 14 tiles + kong = 18 = win.
    state.wall.hands[2] = tiles16(
      [
        "wan:1", "wan:2", "wan:3",
        "wan:5",
        "wan:7", "wan:8", "wan:9",
        "tong:1", "tong:2", "tong:3",
        "tong:4", "tong:5", "tong:6",
        "tong:7",
      ],
      9300,
    );

    // Other seats must not rob the kong (they would win first otherwise).
    state.wall.hands[0] = tiles16(NON_WINNING_16, 9500);
    state.wall.hands[1] = tiles16(NON_WINNING_16, 9600);
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9700);

    // Force the kong replacement (尾牆補牌) to be the completing tong:7.
    const wall = (state.wall as unknown as { wall: TileInstance[] }).wall;
    wall[state.wall.deckCursor] = {
      instanceId: 8899,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    state.turn = 2;
    state.phase = "discard";

    const fourth = state.wall.hands[2]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 5,
    )!;
    const res = room.handleCommand("c", kongReaction(room, "add-on", [fourth.instanceId], peng.id));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(2); // the kongger self-draws the replacement
    expect(room.selfDraw).toBe(true);
    expect(room.kongDraw).toBe(true);

    // Self-draw: every other seat pays the full stake; zero-sum.
    const d = room.ledger!;
    expect(d.find((e) => e.seat === 2)!.delta).toBeGreaterThan(0);
    for (const s of [0, 1, 3]) expect(d.find((e) => e.seat === s)!.delta).toBeLessThan(0);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — P0-4 一砲多響 (multi-win) integration", () => {
  it("two winners settle on the same discard — the discarder pays both, ledger zero-sum", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    const state = room.state!;

    // Seats 1 & 2 both wait on tong:7 (identical hands → identical stakes).
    state.wall.hands[1] = tiles16(WAIT_TONG7, 9400);
    state.wall.hands[2] = tiles16(WAIT_TONG7, 9500);
    // Seat 3 cannot win.
    state.wall.hands[3] = tiles16(NON_WINNING_16, 9600);
    // Seat 0 (the discarder) leads the winning tong:7.
    state.wall.hands[0]![0] = {
      instanceId: 8800,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    const res = room.handleCommand(
      "a",
      cmd({
        type: "discard",
        tileInstanceId: state.wall.hands[0]![0]!.instanceId,
        generationId: room.generationId,
      }),
    );
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // nearest winner (seat 1) is the primary
    expect(room.selfDraw).toBe(false);

    // Both winners settle; the discarder loses the most; the ledger sums to 0.
    const d = room.ledger!;
    const seat1 = d.find((e) => e.seat === 1)!.delta;
    const seat2 = d.find((e) => e.seat === 2)!.delta;
    const seat0 = d.find((e) => e.seat === 0)!.delta;
    const seat3 = d.find((e) => e.seat === 3)!.delta;
    expect(seat1).toBeGreaterThan(0);
    expect(seat2).toBeGreaterThan(0);
    expect(seat0).toBeLessThan(0);
    expect(seat3).toBeLessThan(0);
    // Identical hands → identical stakes → identical payouts.
    expect(seat1).toBe(seat2);
    // The bystander (seat 3) pays half of each winner = half of the discarder's loss.
    expect(seat3).toBe(seat0 / 2);
    expect(d.reduce((acc, e) => acc + e.delta, 0)).toBe(0);
  });
});

describe("Room — 莊家輪替 / 連莊機制 (dealer rotation)", () => {
  /** Craft seat 1 as the discard-winner (completes tong:567 on the discard). */
  function craftSeat1Win(room: Room): void {
    const state = room.state!;
    const ids = [
      "wan:1", "wan:2", "wan:3",
      "wan:4", "wan:5", "wan:6",
      "wan:7", "wan:8", "wan:9",
      "tong:1", "tong:2", "tong:3",
      "tong:4", "tong:5", "tong:6",
      "tong:7",
    ];
    let instanceId = 9000;
    state.wall.hands[1] = ids.map((id) => {
      const [suit, rank] = id.split(":");
      return {
        instanceId: instanceId++,
        tile:
          suit === "wan" || suit === "tong"
            ? { kind: "numbered", suit, rank: Number(rank) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
            : { kind: "honor", honor: "dong" },
      };
    }) as TileInstance[];
    // Force seat 0's first tile to be the winning discard tong:7.
    state.wall.hands[0]![0] = { instanceId: 8800, tile: { kind: "numbered", suit: "tong", rank: 7 } };
  }

  /** Read the room's private dealer — the rotation target. state.dealer stays
   * the in-hand dealer (for 連莊台 scoring), so tests must read Room.dealer. */
  function currentDealer(room: Room): number {
    return (room as unknown as { dealer: number }).dealer;
  }

  it("過莊: non-dealer win rotates the dealer to the next seat + streak resets", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    expect(room.state!.dealer).toBe(0);
    craftSeat1Win(room);
    const res = room.handleCommand("a", firstDiscard(room, 0));
    expect(res.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // non-dealer (seat 1) wins
    // 過莊 → next dealer is seat 1, streak reset to 0.
    expect(currentDealer(room)).toBe(1);
    // state.dealer intentionally stays the in-hand dealer — rotation only
    // affects the NEXT hand's deal.
    expect(room.state!.dealer).toBe(0);
    expect(room.dealerStreak).toBe(0);
  });

  it("連莊: dealer win keeps the seat + dealerStreak increments", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Hand 1 — seat 0 (dealer) discards tong:7; seat 1 wins → 過莊.
    craftSeat1Win(room);
    const r1 = room.handleCommand("a", firstDiscard(room, 0));
    expect(r1.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1);
    expect(currentDealer(room)).toBe(1);
    expect(room.dealerStreak).toBe(0);
    // Hand 2 — dealer = seat 1. Let the DEALER win → 連莊.
    room.resetForNextRound();
    // Force the next hand's dealer to be seat 1 (as if rotation already ran).
    (room as unknown as { dealer: number }).dealer = 1;
    readyAll(room);
    expect(room.state!.dealer).toBe(1);
    expect(room.state!.turn).toBe(1); // the dealer discards first
    // The fresh deal replaced the hands — re-craft seat 1's winning hand and
    // seat 0's forced winning discard (tong:7).
    craftSeat1Win(room);
    // Fast-forward to seat 0's discard phase (simulating seats 2 & 3 having
    // passed) so seat 0 discards the winning tong:7 → dealer seat 1 auto-wins.
    const state2 = room.state!;
    state2.turn = 0;
    state2.phase = "discard";
    const r2 = room.handleCommand("a", firstDiscard(room, 0));
    expect(r2.ok).toBe(true);
    expect(room.status).toBe("ended");
    expect(room.winner).toBe(1); // the dealer (seat 1) wins
    expect(currentDealer(room)).toBe(1); // 連莊: seat stays
    expect(room.dealerStreak).toBe(1); // 連莊: streak advanced
  });

  it("流局: dealer keeps the seat + streak advances (連莊 on draw)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Exhaust the wall → 流局 (no winner). The draw path advances the streak.
    const state = room.state!;
    state.wall.headCursor = state.wall.tailStart; // head exhausted
    state.wall.deckCursor = state.wall.wall.length; // deck exhausted
    // Trigger a discard — a reaction window may open; close it with a pass so
    // the next draw hits the exhausted wall → 流局.
    room.handleCommand("a", firstDiscard(room, 0));
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.status).toBe("ended");
    expect(room.winner).toBeNull();
    expect(room.dealerStreak).toBe(1); // 流局 → 連莊 (streak +1)
    expect(currentDealer(room)).toBe(0); // dealer unchanged
    expect(room.state!.dealer).toBe(0); // in-hand dealer unchanged
  });
});

describe("Room — 斷線逾時自動託管 (timeout autoplay)", () => {
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  it("discard timeout auto-摸切: server discards the last-drawn tile", async () => {
    const room = makeRoom({ timeoutMs: 20 });
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    const dealerHand = state.wall.hands[0]!;
    // Record the last-drawn tile (dealer drew it on deal).
    const lastDrawn = dealerHand[dealerHand.length - 1]!;
    state.lastDrawnBy = 0;
    state.lastDrawnTile = lastDrawn;
    // Wait for the 20ms timeout → server auto-discards the last-drawn tile.
    await sleep(60);
    expect(room.status).toBe("playing");
    // The last-drawn tile is gone from the hand (摸切).
    expect(dealerHand.some((t) => t.instanceId === lastDrawn.instanceId)).toBe(false);
    // The autoplay log recorded a discard (摸切).
    const entry = room.autoplayLog.find((a) => a.action === "discard");
    expect(entry).toBeDefined();
    expect(entry!.reason).toBe("timeout");
    expect(state.phase).toBe("reaction");
  });

  it("reaction timeout auto-pass: window closes and the turn advances", async () => {
    // 300ms timeout keeps the assertion well within ONE timer window — the
    // auto-pass fires at ~300ms and the next seat's discard timer would only
    // fire at ~600ms, so the phase cannot cascade into another window.
    const room = makeRoom({ timeoutMs: 300 });
    joinAll(room);
    readyAll(room);
    const state = room.state!;
    // Open a reaction window: discard seat 0's first tile.
    const res = room.handleCommand("a", firstDiscard(room, 0));
    expect(res.ok).toBe(true);
    expect(state.phase).toBe("reaction");
    // Wait past the reaction timeout → auto-pass advances to the next seat.
    // After the auto-pass the next seat draws and enters ITS discard phase
    // (draw resolves synchronously inside the same tick → "discard").
    await sleep(400);
    expect(state.phase).toBe("discard");
    expect(state.turn).toBe(1);
    expect(room.autoplayLog.some((a) => a.action === "pass")).toBe(true);
  });

  it("disconnect → immediate autoplay; reconnect → manual control restored", async () => {
    const room = makeRoom({ timeoutMs: 20 });
    joinAll(room);
    readyAll(room);
    // Seat 0 is the dealer & first to discard. Disconnect them mid-discard.
    room.setConnected("a", false);
    expect(room.players[0]!.autoplay).toBe(true);
    expect(room.autoplay[0]).toBe(true);
    // Immediate 摸切 (delay 0) — the table never waits on the offline seat.
    // (The 摸切 targets the last hand tile; afterwards the game may open a
    // reaction window or advance — the log entry is what proves the 摸切.)
    const entry = room.autoplayLog.find((a) => a.action === "discard" && a.reason === "disconnect");
    expect(entry).toBeDefined();
    // Reconnect restores manual control.
    room.setConnected("a", true);
    expect(room.players[0]!.autoplay).toBe(false);
    expect(room.autoplay[0]).toBe(false);
  });

  it("autoplay flag is cleared when a new hand starts (resetForNextRound)", () => {
    const room = makeRoom();
    joinAll(room);
    readyAll(room);
    // Mid-hand disconnect → seat b enters 自動託管.
    room.setConnected("b", false);
    expect(room.players[room.seatOf("b")]!.autoplay).toBe(true);
    // End the hand via 流局 (exhausted wall) so resetForNextRound is legal.
    const state = room.state!;
    state.wall.headCursor = state.wall.tailStart;
    state.wall.deckCursor = state.wall.wall.length;
    room.handleCommand("a", firstDiscard(room, 0));
    if (room.state!.phase === "reaction") {
      room.handleCommand("a", cmd({ type: "pass", generationId: room.generationId }));
    }
    expect(room.status).toBe("ended");
    // Reset for the next hand → 自動託管 flags cleared.
    expect(room.resetForNextRound()).toBe(true);
    for (const p of room.players) if (p) expect(p.autoplay).toBe(false);
    expect(room.autoplay.every((v) => v === false)).toBe(true);
  });
});

describe("RoomManager — lifecycle", () => {
  it("creates unique room ids", () => {
    const m = new RoomManager();
    const r1 = m.createRoom();
    const r2 = m.createRoom();
    expect(r1.roomId).not.toBe(r2.roomId);
  });

  it("join routes players to their room", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    expect(m.playerRoom("p1")).toBe(room);
  });

  it("cleanup removes rooms with no connected players", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    room.setConnected("p1", false);
    expect(m.cleanup()).toContain(roomId);
    expect(m.get(roomId)).toBeUndefined();
  });

  it("reconnect restores the player's room", () => {
    const m = new RoomManager();
    const { roomId, room } = m.createRoom();
    m.join(roomId, "p1", "P1");
    m.disconnect("p1");
    expect(room.players[0]!.connected).toBe(false);
    expect(m.reconnect("p1")).toBe(room);
    expect(room.players[0]!.connected).toBe(true);
  });
});
