/**
 * ai-smoke.ts — smoke test for the 3-AI auto-fill flow (serve:web mode).
 *
 * Connects ONE human WS client to ws://localhost:PORT/ws, creates a room,
 * and verifies:
 *   1. The AiController auto-joins 3 AI seats (ai-0/ai-1/ai-2).
 *   2. All 3 AIs auto-ready.
 *   3. After the human readies, the game starts automatically.
 *   4. AI seats actually play (each AI discards at least once during the hand).
 *   5. After a hand ends, the AIs auto-ready and the next hand starts.
 *
 * Usage (server must be running with ENABLE_AI on):
 *   node dist/apps/server/src/scripts/ai-smoke.js [WS_URL] [DURATION_MS]
 *
 * Exit 0 = PASS, 1 = FAIL.
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3002/ws";
const DURATION_MS = Number(process.argv[3] ?? 120_000);

let opCounter = 0;
const nextOp = (): string => `smoke-${++opCounter}`;

// --- Minimal wire types (mirror ClientSnapshot / TileWire from snapshot.ts) ---

interface TileWireLike {
  instanceId: number;
  id: string;
}

interface PlayerViewLike {
  seat: number;
  playerId: string | null;
  playerName: string;
  connected: boolean;
  ready: boolean;
  autoplay: boolean;
  handCount: number;
  /** Full hand — only populated for the viewer (you). */
  hand: TileWireLike[] | null;
}

interface ClientSnapshotLike {
  roomId: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  you: number;
  dealer: number | null;
  turn: number | null;
  gamePhase: string | null;
  players: PlayerViewLike[];
  lastDiscardBy: number | null;
  autoplayLog: Array<{ seat: number; action: string; reason: string; at: number }>;
  settlement: { winner: number | null; ledger: unknown[]; scores: number[] } | null;
}

interface SnapshotEventLike {
  roomId?: string;
  generationId?: number;
  snapshot?: ClientSnapshotLike;
}

const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
  console.log(`[ai-smoke] ${ok ? "✅ PASS" : "❌ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const aiJoined = new Set<string>();
const aiReady = new Set<string>();
const aiActed = new Set<string>();
let humanPlayerId: string | null = null;
let humanSeat: number | null = null;
let gameStarted = false;
let gameStartedNext = false;
let gameEnded = 0;
let nextStarted = 0;
let lastSnap: ClientSnapshotLike | null = null;

const ws = new WebSocket(WS_URL);

const timeout = setTimeout(() => {
  console.log("[ai-smoke] ⏰ overall timeout reached");
  finish();
}, DURATION_MS + 10_000);

function seatToPlayerId(snap: ClientSnapshotLike, seat: number): string | null {
  const p = snap.players[seat];
  return p ? p.playerId : null;
}

function finish(): void {
  clearTimeout(timeout);
  clearInterval(tick);
  const aiSeats = ["ai-0", "ai-1", "ai-2"];
  const allJoined = aiSeats.every((id) => aiJoined.has(id));
  const allReady = aiSeats.every((id) => aiReady.has(id));
  const allActed = aiSeats.every((id) => aiActed.has(id));

  check("3 AI seats auto-joined (ai-0/ai-1/ai-2)", allJoined, `joined=${[...aiJoined].join(",")}`);
  check("3 AIs auto-ready in lobby", allReady, `ready=${[...aiReady].join(",")}`);
  check("game started after human ready", gameStarted);
  check("each AI discarded at least once", allActed, `acted=${[...aiActed].join(",")}`);
  check("hand ended + next hand started (AI loop works)", gameEnded >= 1 && nextStarted >= 1, `ended=${gameEnded} nextStarted=${nextStarted}`);

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n[ai-smoke] 總計: ${checks.length - failed}/${checks.length} 項通過`);
  try { ws.close(); } catch { /* ignore */ }
  process.exit(failed === 0 ? 0 : 1);
}

ws.on("open", () => {
  console.log(`[ai-smoke] connected to ${WS_URL}`);
  ws.send(JSON.stringify({ type: "create", operationId: nextOp(), playerName: "測試員" }));
  console.log("[ai-smoke] sent create");
});

ws.on("message", (data) => {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(String(data));
  } catch {
    return;
  }
  const type = msg.type as string;

  if (type === "welcome") {
    console.log(`[ai-smoke] ← welcome`, JSON.stringify(msg).slice(0, 200));
    humanPlayerId = msg.playerId as string | null;
  } else if (type === "room.created" || type === "player.joined") {
    console.log(`[ai-smoke] ← ${type}`, JSON.stringify(msg).slice(0, 200));
  } else if (type === "game.started") {
    // Count only hands that started AFTER at least one hand ended — that proves
    // the AI auto-ready loop starts the next hand on its own.
    if (gameEnded >= 1) {
      nextStarted += 1;
      gameStartedNext = true;
    }
    if (!gameStarted) {
      gameStarted = true;
      console.log(`[ai-smoke] ← game.started (hand #1) dealer=${String(msg.dealer)} streak=${String(msg.dealerStreak)}`);
    } else {
      console.log(`[ai-smoke] ← game.started (next hand) dealer=${String(msg.dealer)} streak=${String(msg.dealerStreak)}`);
    }
  } else if (type === "game.ended") {
    gameEnded += 1;
    console.log(`[ai-smoke] ← game.ended winner=${String(msg.winner)}`);
    // AIs auto-ready → next hand starts on its own.
  } else if (type === "snapshot") {
    const snap = (msg as unknown as SnapshotEventLike).snapshot;
    if (!snap) return;
    // Diagnose the post-game.ended window: show status + ready flags so we can
    // see whether AIs re-ready and whether the next hand ever starts.
    if (gameEnded >= 1 && !gameStartedNext) {
      console.log(
        `[ai-smoke] 🔎 snap status=${snap.status} players=${snap.players
          .map((p) => `${p.playerId ?? "?"}:${p.ready ? "R" : "-"}:${p.connected ? "C" : "D"}`)
          .join(" ")} turn=${snap.turn} phase=${snap.gamePhase}`,
      );
    }
    lastSnap = snap;

    // --- Track AI join / ready from the players table. ---
    for (const p of snap.players) {
      const id = p.playerId;
      if (!id || !id.startsWith("ai-")) continue;
      if (p.connected) aiJoined.add(id);
      if (p.ready) aiReady.add(id);
    }

    // --- Track human seat (the non-AI player). ---
    if (humanSeat === null) {
      const me = snap.players.find((p) => p.playerId && !p.playerId.startsWith("ai-"));
      if (me) humanSeat = me.seat;
    }

    // --- Track AI discards via lastDiscardBy (a discard advances the game). ---
    if (snap.lastDiscardBy !== null && gameStarted) {
      const id = seatToPlayerId(snap, snap.lastDiscardBy);
      if (id && id.startsWith("ai-")) aiActed.add(id);
    }
  }
});

// Periodically drive the human seat: ready in lobby / ended, discard on its turn.
const tick = setInterval(() => {
  const snap = lastSnap;
  if (!snap) return;

  // The human seat may change per hand (dealer rotation); always resolve from
  // the players table so we never act on a stale seat.
  const me = snap.players.find((p) => p.playerId && !p.playerId.startsWith("ai-"));
  if (!me) return;

  // Lobby / ended → ready (human must ready once per round; AIs already ready).
  if (snap.status === "lobby" || snap.status === "ended") {
    if (!me.ready) {
      ws.send(JSON.stringify({ type: "ready", operationId: nextOp() }));
      if (snap.status === "ended") console.log("[ai-smoke] human ready for next round");
    }
    return;
  }

  // During the hand: if it's my discard turn, discard my first tile.
  if (snap.status === "playing" && snap.gamePhase === "discard" && snap.turn === me.seat) {
    const myHand = me.hand ?? [];
    if (myHand.length > 0) {
      const tileInstanceId = myHand[0]!.instanceId;
      ws.send(JSON.stringify({ type: "discard", tileInstanceId, operationId: nextOp() }));
    }
  }
}, 500);
