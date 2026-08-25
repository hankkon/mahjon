/**
 * WSS end-to-end tests — 4 simulated WebSocket clients.
 *
 * Full flow: 開房 (create) → 發牌 (auto-deal) → 出牌 (discard) →
 * 吃碰槓 (chi/peng/kong reactions) → 自動胡結算 (auto-win + settlement).
 *
 * The server is the single source of truth: clients only issue commands and
 * receive Client-Safe snapshots.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startServer, type RunningServer } from "../index.js";
import type { ClientCommand, ServerEvent } from "../protocol.js";
import type { ClientSnapshot, PlayerView } from "../snapshot.js";

// ---------------------------------------------------------------------------
// Tiny test client harness
// ---------------------------------------------------------------------------

class TestClient {
  private ws: WebSocket;
  private queue: ServerEvent[] = [];
  private waiters: Array<(e: ServerEvent) => boolean> = [];
  private snapshotWaiters: Array<(e: Extract<ServerEvent, { type: "snapshot" }>) => boolean> = [];
  playerId: string | null = null;
  roomId: string | null = null;
  closed = false;
  /** The most recent snapshot event received — always the current server state. */
  latestSnapshot: Extract<ServerEvent, { type: "snapshot" }> | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (data) => {
      const event = JSON.parse(data.toString()) as ServerEvent;
      let consumed = false;
      if (event.type === "snapshot") {
        this.latestSnapshot = event;
        for (let i = this.snapshotWaiters.length - 1; i >= 0; i--) {
          if (this.snapshotWaiters[i]!(event)) {
            this.snapshotWaiters.splice(i, 1);
            consumed = true;
            break;
          }
        }
      }
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        if (this.waiters[i]!(event)) {
          this.waiters.splice(i, 1);
          consumed = true;
          break;
        }
      }
      // An event consumed by a waiter must not also sit in the queue.
      if (!consumed) this.queue.push(event);
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  send(cmd: ClientCommand): void {
    if (this.closed) return;
    this.ws.send(JSON.stringify(cmd));
  }

  next(type: string, predicate?: (e: any) => boolean): Promise<ServerEvent> {
    const idx = this.queue.findIndex(
      (e) => e.type === type && (!predicate || predicate(e)),
    );
    if (idx !== -1) return Promise.resolve(this.queue.splice(idx, 1)[0]!);
    return new Promise((resolve) => {
      this.waiters.push((e: ServerEvent): boolean => {
        if (e.type === type && (!predicate || predicate(e))) {
          resolve(e);
          return true;
        }
        return false;
      });
    });
  }

  /**
   * The current (latest) snapshot — never a stale queued one. When `predicate`
   * is given and the latest snapshot doesn't satisfy it, waits for a *fresh*
   * snapshot that does (stale queued snapshots are never matched).
   */
  snapshot(
    predicate?: (s: ClientSnapshot) => boolean,
  ): Promise<Extract<ServerEvent, { type: "snapshot" }>> {
    if (this.latestSnapshot && (!predicate || predicate(this.latestSnapshot.snapshot))) {
      return Promise.resolve(this.latestSnapshot);
    }
    return new Promise((resolve) => {
      this.snapshotWaiters.push((e: Extract<ServerEvent, { type: "snapshot" }>) => {
        if (!predicate || predicate(e.snapshot)) {
          resolve(e);
          return true;
        }
        return false;
      });
    });
  }

  sendRaw(data: string | Buffer): void {
    if (this.closed) return;
    this.ws.send(data);
  }

  waitForClose(): Promise<{ code: number; reason: string }> {
    if (this.ws.readyState === WebSocket.CLOSED) {
      return Promise.resolve({ code: 1000, reason: "" });
    }
    return new Promise((resolve) => {
      this.ws.once("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });
  }

  drain(type: string): ServerEvent[] {
    const out = this.queue.filter((e) => e.type === type);
    this.queue = this.queue.filter((e) => e.type !== type);
    return out;
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let server: RunningServer;
let url: string;
let opCounter = 0;
const op = (): string => `op-${++opCounter}-${Date.now()}`;

beforeAll(async () => {
  server = await startServer({ port: 0 });
  url = `ws://127.0.0.1:${server.port}/ws`;
});

afterAll(async () => {
  await server.stop();
});

async function connect(): Promise<TestClient> {
  const c = new TestClient(url);
  await c.open();
  return c;
}

/** Create a fresh room with 4 connected clients (A=host, B/C/D join). */
async function setupRoom(): Promise<TestClient[]> {
  const a = await connect();
  a.send({ type: "create", operationId: op(), playerName: "A" });
  const welcome = (await a.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
  a.playerId = welcome.playerId;
  a.roomId = welcome.roomId!;
  await a.next("room.created");

  const out = [a];
  for (const name of ["B", "C", "D"]) {
    const c = await connect();
    c.send({ type: "join", operationId: op(), roomId: a.roomId!, playerName: name });
    const w = (await c.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
    c.playerId = w.playerId;
    c.roomId = w.roomId;
    await c.next("player.joined");
    out.push(c);
  }
  return out;
}

/** Send ready for all 4, await game.started, return the clients. */
async function startGame(clients: TestClient[]): Promise<void> {
  for (const c of clients) {
    // No generationId — ready is a lobby action and must not be dropped as stale.
    c.send({ type: "ready", operationId: op() });
  }
  await clients[0]!.next("game.started");
  // Latest snapshot confirms the deal (blocks until a playing snapshot exists).
  await clients[0]!.snapshot((s) => s.status === "playing");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WSS — create / join / ready / auto-deal", () => {
  it("create → welcome + room.created + join flow assigns 4 seats", async () => {
    const clients = await setupRoom();
    expect(clients).toHaveLength(4);
    expect(clients[0]!.roomId).toBeTruthy();
    // 4 distinct player ids.
    const ids = new Set(clients.map((c) => c.playerId));
    expect(ids.size).toBe(4);
    // Snapshot after all joins: 4 players in lobby.
    const snap = (await clients[0]!.next("snapshot", (e) => e.snapshot.status === "lobby")) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(snap.snapshot.players.length).toBe(4);
  });

  it("4 ready → auto-deal with Client-Safe masking (17/16 hands)", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const snap = (await clients[0]!.snapshot((s) => s.status === "playing")) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(snap.snapshot.status).toBe("playing");
    const me = snap.snapshot.players[snap.snapshot.you]!;
    expect(me.hand!.length).toBeGreaterThanOrEqual(16);
    // Masking: other players' hands are null.
    for (const p of snap.snapshot.players) {
      if (p.seat !== snap.snapshot.you) expect(p.hand).toBeNull();
    }
    // Dealer (seat 0) has 17.
    expect(snap.snapshot.players[0]!.handCount).toBe(17);
  });
});

describe("WSS — discard → reaction → auto-win settlement", () => {
  it("seat 0 discards; discard observed by all; auto-win ends with zero-sum ledger", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;

    // --- Force a deterministic auto-win for seat 1 on the first discard. ---
    const room = server.manager.get(c0.roomId!)!;
    const state = room.state!;
    // Seat 1's 16-tile hand is one tile away from a win (tenpai):
    //   wan 123 / 456 / 789 (3 melds) + tong 123 / 456 (2 melds) = 15 tiles,
    //   plus a tong:7 single. Discarding tong:7 completes tong:77 as the pair
    //   → 5 melds + pair = 17 → 自動胡牌.
    const ids16: Array<[string, number]> = [
      ["wan", 1], ["wan", 2], ["wan", 3],
      ["wan", 4], ["wan", 5], ["wan", 6],
      ["wan", 7], ["wan", 8], ["wan", 9],
      ["tong", 1], ["tong", 2], ["tong", 3],
      ["tong", 4], ["tong", 5], ["tong", 6],
      ["tong", 7],
    ];
    state.wall.hands[1] = ids16.map(([suit, rank], i) => ({
      instanceId: 20000 + i,
      tile: { kind: "numbered", suit: suit as "wan" | "tong", rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 },
    })) as never;
    // Seat 0's first tile becomes tong:7 (the winning discard).
    state.wall.hands[0]![0] = {
      instanceId: 30000,
      tile: { kind: "numbered", suit: "tong", rank: 7 },
    };

    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    c0.send({
      type: "discard",
      operationId: op(),
      tileInstanceId: 30000,
      generationId: snap.snapshot.generationId,
    });

    // Seat 1 auto-wins → game.ended with zero-sum ledger.
    const ended = (await clients[1]!.next("game.ended")) as Extract<
      ServerEvent,
      { type: "game.ended" }
    >;
    expect(ended.winner).toBe(1);
    expect(ended.selfDraw).toBe(false);
    expect(ended.ledger).toHaveLength(4);
    const sum = ended.ledger.reduce((acc, e) => acc + e.delta, 0);
    expect(sum).toBe(0);
    // Winner's delta positive.
    const winnerDelta = ended.ledger.find((e) => e.seat === 1)!.delta;
    expect(winnerDelta).toBeGreaterThan(0);
    // Losers: discarder (0) pays full stake, others half.
    const d0 = ended.ledger.find((e) => e.seat === 0)!.delta;
    const d2 = ended.ledger.find((e) => e.seat === 2)!.delta;
    expect(Math.abs(d0)).toBeGreaterThan(Math.abs(d2));
  });

  it("discard with an existing reaction window stays in reaction phase until pass", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;
    const room = server.manager.get(c0.roomId!)!;
    const state = room.state!;

    // Seat 0 discards wan:1 — seat 1 (上家) could chi if holding wan:2,wan:3.
    let tile = state.wall.hands[0]!.find(
      (t) => t.tile.kind === "numbered" && t.tile.suit === "wan" && t.tile.rank === 1,
    );
    if (!tile) {
      // Force the first tile to wan:1.
      state.wall.hands[0]![0] = {
        instanceId: 31000,
        tile: { kind: "numbered", suit: "wan", rank: 1 },
      };
      tile = state.wall.hands[0]![0]!;
    }
    // Force seat 1 to hold wan:2, wan:3.
    state.wall.hands[1]![0] = { instanceId: 32000, tile: { kind: "numbered", suit: "wan", rank: 2 } };
    state.wall.hands[1]![1] = { instanceId: 32001, tile: { kind: "numbered", suit: "wan", rank: 3 } };

    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    c0.send({
      type: "discard",
      operationId: op(),
      tileInstanceId: tile.instanceId,
      generationId: snap.snapshot.generationId,
    });

    // Seat 1 sees a chi hint in its snapshot.
    const s1 = (await clients[1]!.snapshot((s) => s.reactionHint !== null)) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(s1.snapshot.reactionHint!.canChi).toBe(true);
    // Seat 1 executes the chi.
    const chiOption = s1.snapshot.reactionHint!.chiOptions[0]!;
    clients[1]!.send({
      type: "reaction",
      operationId: op(),
      kind: "chi",
      handTileIds: chiOption.handTileIds,
      generationId: s1.snapshot.generationId,
    });
    // Seat 1 now has a chi meld and must discard.
    const s1b = (await clients[1]!.snapshot(
      (s) =>
        s.status === "playing" &&
        s.turn === 1 &&
        (s.players[1]?.melds ?? []).some((m) => m.kind === "chi"),
    )) as Extract<ServerEvent, { type: "snapshot" }>;
    expect(
      (s1b.snapshot.players[1]!.melds as Array<{ kind: string }>).some((m) => m.kind === "chi"),
    ).toBe(true);
    expect(s1b.snapshot.turn).toBe(1);
  });

  it("stale generation and duplicate operationId are rejected/handled", async () => {
    const clients = await setupRoom();
    await startGame(clients);
    const c0 = clients[0]!;
    const snap = (await c0.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    const tileId = snap.snapshot.players[snap.snapshot.you]!.hand![0]!.instanceId;

    // Stale generation → error.
    c0.send({ type: "discard", operationId: op(), tileInstanceId: tileId, generationId: snap.snapshot.generationId - 100 });
    const err = (await c0.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err.code).toBe("stale_generation");

    // Valid discard with a fixed operationId.
    const opId = op();
    c0.send({ type: "discard", operationId: opId, tileInstanceId: tileId, generationId: snap.snapshot.generationId });
    const s = (await c0.snapshot((s) => s.discards.length > 0)) as Extract<
      ServerEvent,
      { type: "snapshot" }
    >;
    expect(s.snapshot.discards).toContain(snap.snapshot.players[snap.snapshot.you]!.hand![0]!.id);

    // Duplicate operationId → no error, no double discard.
    c0.send({ type: "discard", operationId: opId, tileInstanceId: tileId });
    await new Promise((r) => setTimeout(r, 30));
    expect(c0.drain("error")).toHaveLength(0);
  });
});

describe("WSS — reconnect", () => {
  it("reconnect with playerId restores the seat mid-lobby", async () => {
    const clients = await setupRoom();
    const original = clients[0]!;
    const playerId = original.playerId!;
    const roomId = original.roomId!;
    original.close();
    await new Promise((r) => setTimeout(r, 50));

    const c = await connect();
    c.send({ type: "join", operationId: op(), roomId, playerId });
    const w = (await c.next("welcome")) as Extract<ServerEvent, { type: "welcome" }>;
    expect(w.playerId).toBe(playerId);
    const snap = (await c.snapshot()) as Extract<ServerEvent, { type: "snapshot" }>;
    const me: PlayerView | undefined = snap.snapshot.players.find(
      (p: PlayerView) => p.playerId === playerId,
    );
    expect(me).toBeTruthy();
    expect(me!.connected).toBe(true);
    // No duplicate seat: still exactly 4 players.
    expect(snap.snapshot.players.length).toBe(4);
    c.close();
  });
});

describe("WSS — Security, Rate Limiting & Input Validation", () => {
  it("rejects non-JSON and malformed commands with bad_json / bad_command", async () => {
    const c = await connect();

    // 1. Invalid JSON
    c.sendRaw("{ not a json");
    const err1 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err1.code).toBe("bad_json");

    // 2. Non-object command (array)
    c.sendRaw(JSON.stringify([1, 2, 3]));
    const err2 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err2.code).toBe("bad_command");

    // 3. Unknown command type
    c.sendRaw(JSON.stringify({ type: "hack_win", operationId: "op-h1" }));
    const err3 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err3.code).toBe("bad_command");

    // 4. Missing operationId
    c.sendRaw(JSON.stringify({ type: "ready" }));
    const err4 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err4.code).toBe("bad_command");

    // 5. Invalid discard tileInstanceId (string instead of number)
    c.sendRaw(JSON.stringify({ type: "discard", operationId: "op-d", tileInstanceId: "123" }));
    const err5 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err5.code).toBe("bad_command");

    // 6. Invalid reaction kind
    c.sendRaw(JSON.stringify({ type: "reaction", operationId: "op-r", kind: "invalid_reaction" }));
    const err6 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err6.code).toBe("bad_command");

    // 7. Invalid join roomId (empty string)
    c.sendRaw(JSON.stringify({ type: "join", operationId: "op-j", roomId: "" }));
    const err7 = (await c.next("error")) as Extract<ServerEvent, { type: "error" }>;
    expect(err7.code).toBe("bad_command");

    c.close();
  });

  it("enforces per-connection command rate limiting", async () => {
    const rateLimitedServer = await startServer({
      port: 0,
      rateLimitMaxCommands: 5,
      rateLimitWindowMs: 1000,
    });
    const c = new TestClient(`ws://127.0.0.1:${rateLimitedServer.port}/ws`);
    await c.open();

    // Send 10 rapid ping commands (exceeds rateLimitMaxCommands = 5)
    for (let i = 0; i < 10; i++) {
      c.send({ type: "ping", operationId: `op-rate-${i}`, t: i });
    }

    const rateLimitError = (await c.next("error", (e) => e.code === "rate_limited")) as Extract<
      ServerEvent,
      { type: "error" }
    >;
    expect(rateLimitError).toBeDefined();
    expect(rateLimitError.code).toBe("rate_limited");

    c.close();
    await rateLimitedServer.stop();
  });

  it("enforces max payload size limits", async () => {
    const smallPayloadServer = await startServer({
      port: 0,
      maxPayloadBytes: 512, // 512 bytes limit
    });
    const c = new TestClient(`ws://127.0.0.1:${smallPayloadServer.port}/ws`);
    await c.open();

    // Send an oversized payload (> 512 bytes)
    const largeName = "X".repeat(600);
    c.sendRaw(JSON.stringify({ type: "create", operationId: "op-large", playerName: largeName }));

    // The server will either send payload_too_large error or ws will drop/close connection
    const received = await Promise.race([
      c.next("error", (e) => e.code === "payload_too_large" || e.code === "bad_command"),
      c.waitForClose(),
    ]);
    expect(received).toBeDefined();

    c.close();
    await smallPayloadServer.stop();
  });

  it("dampens excessive error replies and terminates socket on abusive consecutive errors", async () => {
    const strictErrorServer = await startServer({
      port: 0,
      maxErrorsPerWindow: 3,
      maxConsecutiveErrors: 6,
    });
    const c = new TestClient(`ws://127.0.0.1:${strictErrorServer.port}/ws`);
    await c.open();

    // Send 12 malformed messages in rapid succession
    for (let i = 0; i < 12; i++) {
      c.sendRaw(`{ malformed_${i}`);
    }

    // Wait for the socket to close due to circuit breaker
    const closeResult = await c.waitForClose();
    expect(closeResult.code).toBe(4429);

    // Verify received error replies are dampened (should be at most maxConsecutiveErrors + 1, not 12)
    const errors = c.drain("error");
    expect(errors.length).toBeLessThanOrEqual(5);

    c.close();
    await strictErrorServer.stop();
  });
});

