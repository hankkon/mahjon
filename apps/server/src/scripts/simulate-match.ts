/**
 * simulate-match.ts — 20-round headless bot simulation (with autoplay + rotation).
 *
 * Four WebSocket bots (A/B/C/D) play full Taiwan 16-tile mahjong rounds end to
 * end against a running server at ws://localhost:3000/ws:
 *   1. A creates a room, B/C/D join, everyone readies → auto-deal.
 *   2. Each bot reacts to snapshots:
 *        - own discard turn  → discard a random tile (optionally self-kong first).
 *        - reaction window   → respond kong > peng > chi when eligible.
 *   3. Autoplay (斷線逾時自動託管) scenarios:
 *        - At a deterministic round boundary a bot drops its connection
 *          mid-round; the server 自動託管s (摸切 / pass) so the table never
 *          stalls. The bot reconnects with its playerId → manual control.
 *   4. Dealer rotation verification: we track the dealer seat + 連莊 streak
 *      announced in game.started / game.ended and assert the invariant
 *      (dealer win/流局 → same seat + streak+1; non-dealer win → next seat,
 *      streak 0) every round.
 *
 * Usage (after `pnpm --filter @taiwan-mahjong/server build`):
 *   node dist/apps/server/src/scripts/simulate-match.js [WS_URL] [ROUNDS]
 *
 * The server should be started with a short timeout for a fast autoplay test:
 *   TIMEOUT_MS=400 node dist/apps/server/src/serve.js
 *
 * Exit code 0 when all rounds complete and all invariants hold; 1 otherwise.
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
const TARGET_ROUNDS = Number(process.argv[3] ?? 20);
const BOT_NAMES = ["A", "B", "C", "D"] as const;

const OVERALL_TIMEOUT_MS = 180_000;
const REACTION_JITTER_MS = 20;

// ---------------------------------------------------------------------------
// Bot state
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  playerId: string | null;
  roomId: string | null;
  seat: number;
  ws: WebSocket | null;
  ready: boolean;
  connected: boolean;
  /** Last snapshot generationId we acted on (dedup). */
  lastActedGen: number;
  /** Incrementing per-bot command counter (operationId uniqueness). */
  opCounter: number;
  /** Tally of reactions actually attempted per round. */
  reactions: { chi: number; peng: number; kong: number; pass: number };
  /** Latest room autoplay audit log observed in a snapshot (for summaries). */
  lastAutoplayLog: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
  /** Reconnect counter (autoplay scenario bookkeeping). */
  reconnects: number;
  /** Absolute round in which this bot should disconnect mid-round. */
  disconnectAtRound: number;
  /** True while the socket is intentionally closed (autoplay scenario). */
  intentionallyDown: boolean;
}

function makeBot(name: string): Bot {
  return {
    name,
    playerId: null,
    roomId: null,
    seat: -1,
    ws: null,
    ready: false,
    connected: false,
    lastActedGen: -1,
    opCounter: 0,
    reactions: { chi: 0, peng: 0, kong: 0, pass: 0 },
    lastAutoplayLog: [],
    reconnects: 0,
    disconnectAtRound: -1,
    intentionallyDown: false,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);

// ---------------------------------------------------------------------------
// Round bookkeeping
// ---------------------------------------------------------------------------

interface RoundResult {
  round: number;
  dealer: number;
  dealerStreak: number;
  winner: number | null;
  winnerName: string;
  selfDraw: boolean;
  kongDraw: boolean;
  discardCount: number;
  reactions: { chi: number; peng: number; kong: number };
  autoplayLog: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
}

const roundResults: RoundResult[] = [];
let currentRound = 0;
/** Discards tallied for the CURRENT round only (reset on each game.ended). */
let roundDiscards = 0;
let fatalError: string | null = null;

/** Dealer seat / streak announced at the CURRENT round's deal (game.started). */
let currentDealer = 0;
let currentStreak = 0;
/** Round of the hand currently in play (increments at each game.started). */
let dealtRound = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `sim-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[sim] ${msg}`);
}

function logRound(msg: string): void {
  console.log(`[sim][round ${currentRound}] ${msg}`);
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Keep an eye on global progress — abort if nothing happens for too long. */
let lastProgressAt = Date.now();
let watchdogTimer: NodeJS.Timeout | null = null;

function touchProgress(): void {
  lastProgressAt = Date.now();
}

function startWatchdog(): void {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    if (fatalError) return;
    if (Date.now() - lastProgressAt > OVERALL_TIMEOUT_MS) {
      fatalError = `Watchdog: no progress for ${OVERALL_TIMEOUT_MS / 1000}s (round ${currentRound})`;
      log(`[sim] FATAL: ${fatalError}`);
      finish();
    }
  }, 5000);
}

// ---------------------------------------------------------------------------
// Autoplay / reconnect helpers
// ---------------------------------------------------------------------------

function disconnectBot(bot: Bot): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.intentionallyDown = true;
  logRound(`🔌 ${bot.name} 斷線（觸發自動託管）`);
  try {
    bot.ws.close();
  } catch {
    /* ignore */
  }
}

function reconnectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} reconnect timeout`)), 10_000);

    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      // Reconnect with the SAME playerId → server restores the seat + manual control.
      send(bot, {
        type: "join",
        operationId: opId(bot, "rejoin"),
        roomId: bot.roomId,
        playerId: bot.playerId,
        playerName: bot.name,
      });
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      bot.connected = false;
      if (!bot.intentionallyDown) log(`${bot.name} 連線關閉`);
    });

    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

// ---------------------------------------------------------------------------
// Bot decision logic (driven by snapshots)
// ---------------------------------------------------------------------------

interface Snap {
  status: string;
  generationId: number;
  you: number;
  turn: number | null;
  gamePhase: string | null;
  players: Array<{
    seat: number;
    autoplay: boolean;
    hand: Array<{ instanceId: number; id: string }> | null;
  }>;
  reactionHint: {
    canChi: boolean;
    canPeng: boolean;
    canKong: boolean;
    chiOptions: Array<{ handTileIds: [number, number]; run: string[] }>;
    kongOptions: Array<{
      kongType: string;
      handTileIds: number[];
      pengMeldId?: number;
    }>;
  } | null;
}

function handleSnapshot(bot: Bot, snap: Snap): void {
  // Skip acting while the bot is intentionally disconnected (offline).
  if (bot.intentionallyDown) return;
  // Dedup: act at most once per generationId.
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  if (snap.status === "ended") return; // handled via game.ended event

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window against someone else's discard. ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    const hint = snap.reactionHint;
    if (hint.canKong && hint.kongOptions.length > 0) {
      const opt = hint.kongOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "kong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      bot.reactions.kong += 1;
      logRound(
        `${bot.name} 明槓/搶槓 (${opt.kongType}) on gen ${snap.generationId}`,
      );
      touchProgress();
      return;
    }
    if (hint.canPeng) {
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "peng"),
        generationId: snap.generationId,
        kind: "peng",
      });
      bot.reactions.peng += 1;
      logRound(`${bot.name} 碰! on gen ${snap.generationId}`);
      touchProgress();
      return;
    }
    if (hint.canChi && hint.chiOptions.length > 0) {
      const opt = hint.chiOptions[0]!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "chi"),
        generationId: snap.generationId,
        kind: "chi",
        handTileIds: opt.handTileIds,
      });
      bot.reactions.chi += 1;
      logRound(
        `${bot.name} 吃! ${opt.run.join(",")} on gen ${snap.generationId}`,
      );
      touchProgress();
      return;
    }
    // Eligible but nothing specific — pass to keep the game moving.
    send(bot, {
      type: "pass",
      operationId: opId(bot, "pass"),
      generationId: snap.generationId,
    });
    bot.reactions.pass += 1;
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // Optional self-kong (closed / add-on) before discarding — 30% chance.
    const hint = snap.reactionHint;
    if (hint && hint.canKong && hint.kongOptions.length > 0 && Math.random() < 0.3) {
      const opt = pickRandom(hint.kongOptions)!;
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "selfkong"),
        generationId: snap.generationId,
        kind: "kong",
        kongType: opt.kongType,
        handTileIds: opt.handTileIds,
        pengMeldId: opt.pengMeldId,
      });
      bot.reactions.kong += 1;
      logRound(`${bot.name} 自槓 (${opt.kongType}) on gen ${snap.generationId}`);
      touchProgress();
      return;
    }

    const tile = pickRandom(hand)!;
    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: tile.instanceId,
    });
    roundDiscards += 1;
    logRound(`${bot.name} 打出 ${tile.id} (gen ${snap.generationId})`);
    touchProgress();
  }
}

// ---------------------------------------------------------------------------
// Round flow
// ---------------------------------------------------------------------------

async function everyoneReadies(): Promise<void> {
  // Restore any bot that is still intentionally down BEFORE readying — the
  // deal requires all four seats connected.
  for (const bot of bots) {
    if (!bot.intentionallyDown) continue;
    bot.intentionallyDown = false;
    bot.reconnects += 1;
    logRound(`🔌 ${bot.name} 重連（恢復手動控制）`);
    try {
      await reconnectBot(bot);
    } catch (err) {
      fatalError = `重連失敗 ${bot.name}: ${err instanceof Error ? err.message : String(err)}`;
      finish();
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  for (const bot of bots) {
    bot.ready = false;
    send(bot, {
      type: "ready",
      operationId: opId(bot, "ready"),
      generationId: undefined,
    });
  }
}

function resetReactionTallies(): void {
  for (const bot of bots) bot.reactions = { chi: 0, peng: 0, kong: 0, pass: 0 };
}

/** Advance to the next round. Only bot A (the room creator) drives this. */
function onGameEnded(payload: {
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  scores: number[];
  dealer: number;
  dealerStreak: number;
}): void {
  currentRound += 1;
  const winnerName = payload.winner === null ? "流局" : (bots[payload.winner]?.name ?? "?");
  const chi = bots.reduce((n, b) => n + b.reactions.chi, 0);
  const peng = bots.reduce((n, b) => n + b.reactions.peng, 0);
  const kong = bots.reduce((n, b) => n + b.reactions.kong, 0);
  // Copy the room's autoplay audit log (best-effort; each bot's last snapshot
  // of the ended room may carry a subset — dedupe by action+seat+reason).
  const autoplayLog: RoundResult["autoplayLog"] = [];
  for (const bot of bots) {
    for (const a of bot.lastAutoplayLog) {
      if (!autoplayLog.some((x) => x.seat === a.seat && x.action === a.action && x.reason === a.reason)) {
        autoplayLog.push(a);
      }
    }
  }
  roundResults.push({
    round: currentRound,
    dealer: payload.dealer,
    dealerStreak: payload.dealerStreak,
    winner: payload.winner,
    winnerName,
    selfDraw: payload.selfDraw,
    kongDraw: payload.kongDraw,
    discardCount: roundDiscards,
    reactions: { chi, peng, kong },
    autoplayLog,
  });
  logRound(
    `🏁 結束: 勝者=${winnerName} 莊=${payload.dealer} 連莊=${payload.dealerStreak} ` +
      `自摸=${payload.selfDraw} 槓上開花=${payload.kongDraw} ` +
      `分數=[${payload.scores.join(",")}] 吃=${chi} 碰=${peng} 槓=${kong}`,
  );
  if (autoplayLog.length > 0) {
    logRound(
      `🤖 自動託管紀錄: ${autoplayLog.map((a) => `${bots[a.seat]!.name} ${a.action}(${a.reason})`).join(", ")}`,
    );
  }
  touchProgress();

  // Schedule the next round's disconnect scenario.
  scheduleDisconnectForNextRound();

  if (currentRound >= TARGET_ROUNDS) {
    log(`✅ 完成 ${TARGET_ROUNDS} 局模擬`);
    finish();
    return;
  }
  log(`第 ${currentRound + 1} 局準備中（全員重新 Ready → 重置房間）…`);
  void everyoneReadies();
}

/** Reset per-round tallies (discards / reactions) when a new hand starts. */
function resetRoundStats(): void {
  roundDiscards = 0;
  resetReactionTallies();
}

// ---------------------------------------------------------------------------
// Autoplay scenario scheduling
// ---------------------------------------------------------------------------

/**
 * Assign the disconnect rounds for the upcoming hands. Deterministic so the
 * scenario always exercises 1-2 offline bots across the 20 rounds. The room
 * creator (A) is never disconnected — it drives the round advancement.
 *   round 5  → C disconnects (then reconnects before the next hand).
 *   round 10 → B disconnects and STAYS down for the whole round.
 *   round 15 → both D and C go down for the round.
 */
/** Persistent record of every scheduled disconnect (for final verification). */
const disconnectScenarios: Array<{ round: number; name: string }> = [];

function scheduleDisconnectForNextRound(): void {
  for (const bot of bots) bot.disconnectAtRound = -1;
  const next = currentRound + 1;
  if (next === 5) {
    bots[2]!.disconnectAtRound = 5; // C
    disconnectScenarios.push({ round: 5, name: "C" });
  } else if (next === 10) {
    bots[1]!.disconnectAtRound = 10; // B
    disconnectScenarios.push({ round: 10, name: "B" });
  } else if (next === 15) {
    bots[3]!.disconnectAtRound = 15; // D
    bots[2]!.disconnectAtRound = 15; // C
    disconnectScenarios.push({ round: 15, name: "D" }, { round: 15, name: "C" });
  }
}

// ---------------------------------------------------------------------------
// Connection setup
// ---------------------------------------------------------------------------

function connectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} connect timeout`)), 10_000);

    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      log(`${bot.name} 連線成功`);
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on("close", () => {
      bot.connected = false;
      if (!bot.intentionallyDown) log(`${bot.name} 連線關閉`);
    });

    ws.on("message", (data) => {
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      handleEvent(bot, evt);
    });
  });
}

function handleEvent(bot: Bot, evt: Record<string, unknown>): void {
  switch (evt.type) {
    case "welcome": {
      bot.playerId = evt.playerId as string;
      bot.roomId = evt.roomId as string | null;
      break;
    }
    case "room.created": {
      bot.roomId = evt.roomId as string;
      log(`[sim] 🏠 房號 ${bot.roomId} 建立（玩家 ${bot.name}）`);
      touchProgress();
      break;
    }
    case "player.joined": {
      const seat = evt.seat as number;
      const name = evt.playerName as string;
      bot.seat = seat;
      bot.roomId = evt.roomId as string;
      log(`[sim] ${name} 入座 seat ${seat} (房 ${bot.roomId})`);
      touchProgress();
      break;
    }
    case "game.started": {
      resetRoundStats();
      // Capture the dealer + streak AT DEAL TIME — this is the source of truth
      // for the rotation invariant (game.ended reports the post-settlement
      // rotation, i.e. the NEXT hand's dealer).
      // Only bot A (the room creator) advances the round counters — every bot
      // receives game.started, so gating here keeps dealtRound in sync with
      // currentRound (otherwise 4 bots would inflate dealtRound to 4×).
      if (bot.name === "A") {
        dealtRound += 1;
        currentDealer = evt.dealer as number;
        currentStreak = evt.dealerStreak as number;
        logRound(`🎲 發牌完成（莊家 ${currentDealer} 連莊${currentStreak}）`);
        touchProgress();
      }
      break;
    }
    case "game.ended": {
      // Only the room creator advances the round — otherwise the same
      // game.ended would be counted once per bot.
      if (bot.name !== "A") break;
      onGameEnded({
        winner: evt.winner as number | null,
        selfDraw: evt.selfDraw as boolean,
        kongDraw: evt.kongDraw as boolean,
        scores: evt.scores as number[],
        // The dealer / streak that governed THIS hand (captured at deal time).
        dealer: currentDealer,
        dealerStreak: currentStreak,
      });
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as Snap & {
        autoplayLog?: Array<{ seat: number; action: "discard" | "pass"; reason: "timeout" | "disconnect" }>;
      };
      if (snap.status === "playing" && bot.seat === -1) {
        // seat comes from player.joined — but guard anyway
        bot.seat = snap.you;
      }
      // Stash the room's autoplay audit log for the ended-round summary.
      if (snap.autoplayLog) bot.lastAutoplayLog = snap.autoplayLog;
      // Autoplay scenario: a scheduled bot drops mid-hand (playing only —
      // lobby snapshots must never trigger the disconnect).
      if (
        snap.status === "playing" &&
        bot.disconnectAtRound === dealtRound &&
        !bot.intentionallyDown
      ) {
        disconnectBot(bot);
        return; // don't act on this snapshot; we're going offline
      }
      handleSnapshot(bot, snap);
      break;
    }
    case "error": {
      const code = evt.code as string;
      const msg = evt.message as string;
      // Ignore benign race errors (stale / wrong phase / already reacted).
      if (code === "stale_generation" || code === "wrong_phase" || code === "no_discard" || code === "illegal_chi" || code === "illegal_peng" || code === "illegal_kong") {
        logRound(`⚠️ ${bot.name} 忽略 ${code}: ${msg}`);
        return;
      }
      if (code === "not_your_turn" || code === "not_lobby") return;
      log(`[sim] ❌ ${bot.name} 收到錯誤 ${code}: ${msg}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Assert the 莊家輪替/連莊 invariant across consecutive rounds.
 * Round n+1's dealer must be:
 *   - same seat as round n when round n had a dealer win or a draw (連莊);
 *   - the next seat after round n's dealer on a non-dealer win (過莊);
 * and dealerStreak must be +1 (連莊) / 0 (過莊) respectively.
 */
function verifyDealerRotation(): string[] {
  const errors: string[] = [];
  for (let i = 1; i < roundResults.length; i++) {
    const prev = roundResults[i - 1]!;
    const cur = roundResults[i]!;
    const expectedDealer =
      prev.winner === null || prev.winner === prev.dealer
        ? prev.dealer
        : (prev.dealer + 1) % 4;
    const expectedStreak =
      prev.winner === null || prev.winner === prev.dealer ? prev.dealerStreak + 1 : 0;
    if (cur.dealer !== expectedDealer) {
      errors.push(
        `局${cur.round}: 莊家應為 ${expectedDealer}（局${prev.round} 莊${prev.dealer} 勝者${prev.winner}），實際 ${cur.dealer}`,
      );
    }
    if (cur.dealerStreak !== expectedStreak) {
      errors.push(
        `局${cur.round}: 連莊應為 ${expectedStreak}，實際 ${cur.dealerStreak}`,
      );
    }
  }
  return errors;
}

/** Verify autoplay actually engaged at least once across the run. */
function verifyAutoplayEngaged(): string[] {
  const errors: string[] = [];
  const total = roundResults.reduce((n, r) => n + r.autoplayLog.length, 0);
  if (total === 0) {
    errors.push("自動託管完全沒有觸發（斷線情境未生效或 server 未啟用 autoplay）");
  }
  // Every scheduled disconnect must have produced at least one autoplay action
  // in its round — an offline bot must never stall the table.
  for (const s of disconnectScenarios) {
    const round = roundResults.find((r) => r.round === s.round);
    if (round && round.autoplayLog.length === 0) {
      errors.push(`局${s.round} ${s.name} 斷線但沒有任何自動託管動作（桌子卡住？）`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let finished = false;
function finish(): void {
  if (finished) return;
  finished = true;
  if (watchdogTimer) clearInterval(watchdogTimer);

  const rotationErrors = verifyDealerRotation();
  const autoplayErrors = verifyAutoplayEngaged();

  const reasons: string[] = [];
  if (fatalError) reasons.push(fatalError);
  if (roundResults.length < TARGET_ROUNDS) {
    reasons.push(`僅完成 ${roundResults.length}/${TARGET_ROUNDS} 局`);
  }
  if (rotationErrors.length > 0) reasons.push(`連莊/過莊驗證失敗 ${rotationErrors.length} 項`);
  if (autoplayErrors.length > 0) reasons.push(`自動託管驗證失敗 ${autoplayErrors.length} 項`);
  if (reasons.length > 0) {
    log(`[sim] ❌ 模擬失敗: ${reasons.join("；")}`);
    for (const e of rotationErrors) log(`[sim] ❌ 連莊驗證: ${e}`);
    for (const e of autoplayErrors) log(`[sim] ❌ 自動託管驗證: ${e}`);
    printSummary();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }

  printSummary();
  for (const bot of bots) bot.ws?.close();
  process.exit(0);
}

function printSummary(): void {
  console.log("\n================ 模擬結果 ================");
  console.log(`目標局數: ${TARGET_ROUNDS}  完成: ${roundResults.length}`);
  const wins = [0, 0, 0, 0];
  const selfDraws = roundResults.filter((r) => r.selfDraw).length;
  const draws = roundResults.filter((r) => r.winner === null).length;
  for (const r of roundResults) {
    if (r.winner !== null) wins[r.winner] = (wins[r.winner] ?? 0) + 1;
  }
  const totals = { chi: 0, peng: 0, kong: 0 };
  for (const r of roundResults) {
    totals.chi += r.reactions.chi;
    totals.peng += r.reactions.peng;
    totals.kong += r.reactions.kong;
  }
  console.log(`勝利: A=${wins[0]} B=${wins[1]} C=${wins[2]} D=${wins[3]} 流局=${draws}`);
  const totalDiscards = roundResults.reduce((n, r) => n + r.discardCount, 0);
  console.log(`自摸局: ${selfDraws}  總棄牌: ${totalDiscards}`);
  console.log(`反應統計: 吃=${totals.chi} 碰=${totals.peng} 槓=${totals.kong}`);
  const totalAutoplay = roundResults.reduce((n, r) => n + r.autoplayLog.length, 0);
  const disconnectActions = roundResults.reduce(
    (n, r) => n + r.autoplayLog.filter((a) => a.reason === "disconnect").length,
    0,
  );
  console.log(`自動託管: 觸發=${totalAutoplay}（斷線=${disconnectActions} 逾時=${totalAutoplay - disconnectActions}）`);
  const reconnects = bots.reduce((n, b) => n + b.reconnects, 0);
  console.log(`重連次數: ${reconnects}`);
  for (const r of roundResults) {
    console.log(
      `  局 ${String(r.round).padStart(2, " ")}: 莊=${r.dealer} 連莊=${r.dealerStreak} ` +
        `勝者=${r.winnerName.padEnd(3)} 自摸=${r.selfDraw ? "Y" : "N"} 槓上=${r.kongDraw ? "Y" : "N"} ` +
        `吃=${r.reactions.chi} 碰=${r.reactions.peng} 槓=${r.reactions.kong}` +
        (r.autoplayLog.length > 0 ? ` 託管[${r.autoplayLog.map((a) => `${bots[a.seat]!.name}${a.action}`).join(",")}]` : ""),
    );
  }
  console.log("==========================================");
}

async function main(): Promise<void> {
  log(`WS=${WS_URL} 目標=${TARGET_ROUNDS} 局`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    log(`[sim] ❌ ${fatalError}`);
    finish();
    return;
  }

  // Small settle delay so all welcome/join events flush.
  await new Promise((r) => setTimeout(r, 300));

  // A creates the room.
  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await new Promise((r) => setTimeout(r, 300));

  // B/C/D join A's room.
  const roomId = bots[0]!.roomId;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    finish();
    return;
  }
  for (const bot of bots.slice(1)) {
    send(bot, {
      type: "join",
      operationId: opId(bot, "join"),
      roomId,
      playerName: bot.name,
    });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Schedule the first round's disconnect scenario (round 5 → C).
  scheduleDisconnectForNextRound();

  log(`[sim] 4 人到齊（房 ${roomId}），全部按準備…`);
  await new Promise((r) => setTimeout(r, 300));
  everyoneReadies();

  // Wait until the target is reached or a fatal error appears.
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (fatalError || roundResults.length >= TARGET_ROUNDS) {
        clearInterval(iv);
        resolve();
      }
    }, 250);
  });

  if (fatalError) {
    log(`[sim] ❌ 模擬失敗: ${fatalError}`);
  }
  finish();
}

void main();
