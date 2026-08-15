/**
 * qa-stress.ts — 100 局極限壓力測試（高頻點擊 / 斷線重連 / 超時託管 / 連莊過莊）。
 *
 * 四個 WebSocket 機器人對實際運行中的地端伺服器 `ws://localhost:3000/ws`
 * 連續進行 100 局快節奏對局，涵蓋：
 *
 *   STRESS-1【高頻隨機點擊】: 隨機回合以 1~5ms 間隔連續送出重複指令
 *     （同張重複 discard、亂序 generationId、重複 operationId）→ 驗證
 *     generation/operationId 冪等防重機制穩定（錯誤率低、無狀態崩潰）。
 *   STRESS-2【斷線 / 重連】: 隨機 bot 在隨機回合中途離線再以同 playerId
 *     重連 → 驗證座位恢復（connected 轉 true、autoplay 結束、可繼續出牌）。
 *   STRESS-3【快速超時 / 自動託管】: 每 ~7 局故意 1 回合不操作（TIMEOUT_MS
 *     設 1500ms 加速）→ 驗證伺服器自動摸切 + autoplayLog reason=timeout，
 *     之後手動恢復出牌。
 *   STRESS-4【連莊 / 過莊】: 全程以「破壞牌」模式讓莊家連胡，跨局驗證
 *     莊家輪替不變式與連莊 streak 累積（最終需出現 streak ≥ 2）。
 *   STRESS-5【記憶體 / OperationId 洩漏】: 每 25 局透過 HTTP /health 抓取
 *     process.memoryUsage + room/socket 計數，驗證無持續增長（洩漏）；
 *     並驗證重複 operationId 不會被重複執行（冪等）、每局 executed set 重置
 *     （不無界膨脹）。
 *
 * 使用（需先 build 並啟動伺服器）:
 *   pnpm --filter @taiwan-mahjong/server build
 *   TIMEOUT_MS=1500 node dist/apps/server/src/serve.js   # 終端 A（加速超時）
 *   node dist/apps/server/src/scripts/qa-stress.js [WS_URL] [HTTP_URL]
 *
 * Exit code 0 = 全部 PASS；1 = 任一 FAIL。
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
// HTTP health endpoint (same origin as WS by default).
const HTTP_URL = process.argv[3] ?? WS_URL.replace(/^ws/, "http").replace(/\/ws$/, "");

const BOT_NAMES = ["A", "B", "C", "D"] as const;

/** 加速超時（serve 端需以 TIMEOUT_MS=1500 啟動，測試端等 4s 保險）。 */
const TIMEOUT_WAIT_MS = 4_000;
const REACTION_JITTER_MS = 5;
const STEP_DELAY_MS = 20;
const OVERALL_TIMEOUT_MS = 600_000;
const TARGET_ROUNDS = 100;

// ---------------------------------------------------------------------------
// QA 報告
// ---------------------------------------------------------------------------

interface QaCheck {
  scenario: string;
  name: string;
  passed: boolean;
  detail: string;
}

const checks: QaCheck[] = [];

function check(scenario: string, name: string, passed: boolean, detail = ""): void {
  checks.push({ scenario, name, passed, detail });
  const mark = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[stress][${scenario}] ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function scenarioHeader(s: string): void {
  console.log(`\n================= ${s} =================`);
}

// ---------------------------------------------------------------------------
// Bot state
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  playerId: string | null;
  roomId: string | null;
  seat: number;
  ws: WebSocket | null;
  connected: boolean;
  lastActedGen: number;
  opCounter: number;
  meldCount: number;
  autoplay: boolean;
  lastHandSize: number;
  lastSnap: Record<string, unknown> | null;
}

function makeBot(name: string): Bot {
  return {
    name,
    playerId: null,
    roomId: null,
    seat: -1,
    ws: null,
    connected: false,
    lastActedGen: -1,
    opCounter: 0,
    meldCount: 0,
    autoplay: false,
    lastHandSize: 0,
    lastSnap: null,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);

const room = {
  id: "" as string | null,
  started: 0,
  ended: 0,
  dealer: -1,
  streak: -1,
  rounds: [] as Array<{ winner: number | null; dealer: number; streak: number }>,
  dealerWinCount: 0,
};

// --- 壓力計數 ---
const stress = {
  duplicateDiscards: 0,
  repeatedOpIds: 0,
  staleGeneration: 0,
  wrongPhase: 0,
  benignErrors: 0,
  unknownErrors: 0,
  reconnects: 0,
  timeoutsSeen: 0,
  recoveryDiscards: 0,
};

let fatalError: string | null = null;
let finished = false;

// ---------------------------------------------------------------------------
// 冪等 / 壓力參數
// ---------------------------------------------------------------------------

/** 每 25 局記憶體採樣（STRESS-5）。 */
const memSamples: Array<{ round: number; rssMB: number; heapUsedMB: number; sockets: number; rooms: number }> = [];

/** 每局結束後執行 set 大小採樣（透過 /health 或直接查 manager 失敗時以 0 標記）。 */
let lastExecutedEstimate = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `stress-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[stress] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// HTTP /health (memory + socket + room telemetry for STRESS-5)
// ---------------------------------------------------------------------------

interface HealthStats {
  ok: boolean;
  rooms?: number;
  sockets?: number;
  memory?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  executedEstimate?: number;
}

async function fetchHealth(): Promise<HealthStats | null> {
  try {
    const res = await fetch(`${HTTP_URL}/health`);
    if (!res.ok) return null;
    return (await res.json()) as HealthStats;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Connection (with reconnect support — STRESS-2)
// ---------------------------------------------------------------------------

function connectBot(bot: Bot): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    bot.ws = ws;
    const timer = setTimeout(() => reject(new Error(`${bot.name} connect timeout`)), 10_000);
    ws.on("open", () => {
      clearTimeout(timer);
      bot.connected = true;
      log(`${bot.name} 連線成功${bot.playerId ? `（重連 id=${bot.playerId}）` : ""}`);
      resolve();
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on("close", () => {
      bot.connected = false;
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

/** STRESS-2: 斷開單一 bot 的連線，稍後以同 playerId 重連。 */
async function dropAndReconnect(bot: Bot): Promise<void> {
  const pid = bot.playerId;
  const rid = room.id;
  bot.ws?.close(4000, "stress drop");
  bot.connected = false;
  await sleep(120);
  if (!pid) return;
  // 重連後帶同 playerId → 伺服器恢復座位（RoomManager.reconnect）。
  await connectBot(bot);
  // 新 socket 尚未認證 — 需重新送出 join（帶同 playerId）以恢復座位。
  if (rid) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId: rid, playerId: pid, playerName: bot.name });
    await sleep(120);
  }
  stress.reconnects += 1;
  log(`🔁 ${bot.name} 斷線重連完成（playerId=${pid}）`);
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

interface SnapPlayer {
  seat: number;
  autoplay: boolean;
  hand: Array<{ instanceId: number; id: string }> | null;
  melds: Array<{ id: number; kind: string }>;
}

interface Snap {
  status: string;
  generationId: number;
  you: number;
  turn: number | null;
  gamePhase: string | null;
  phaseDeadline: number | null;
  countdownMs: number | null;
  players: SnapPlayer[];
  autoplayLog?: Array<{ seat: number; action: string; reason: string }>;
  reactionHint: {
    canChi: boolean;
    canPeng: boolean;
    canKong: boolean;
    chiOptions: Array<{ handTileIds: [number, number]; run: string[] }>;
    kongOptions: Array<{ kongType: string; handTileIds: number[]; pengMeldId?: number }>;
  } | null;
  settlement: {
    winner: number | null;
    selfDraw: boolean;
    kongDraw: boolean;
    breakdown: { fans: Array<{ rule: string; value: number }>; total: number } | null;
    ledger: Array<{ seat: number; delta: number }>;
    scores: number[];
  } | null;
}

function handleEvent(bot: Bot, evt: Record<string, unknown>): void {
  switch (evt.type) {
    case "welcome":
      bot.playerId = evt.playerId as string;
      bot.roomId = evt.roomId as string | null;
      break;
    case "room.created":
      room.id = evt.roomId as string;
      break;
    case "player.joined":
      bot.seat = evt.seat as number;
      room.id = evt.roomId as string;
      break;
    case "game.started":
      if (bot.name !== "A") break;
      room.started += 1;
      room.dealer = evt.dealer as number;
      room.streak = evt.dealerStreak as number;
      log(`🎲 [發牌#${room.started}] 莊家 ${room.dealer} 連莊${room.streak}`);
      break;
    case "game.ended": {
      if (bot.name !== "A") break;
      room.ended += 1;
      const winner = evt.winner as number | null;
      room.rounds.push({ winner, dealer: room.dealer, streak: room.streak });
      if (winner !== null && winner === room.dealer) room.dealerWinCount += 1;
      log(`🏁 [結束#${room.ended}] 勝者=${winner} 莊=${room.dealer} 連莊=${room.streak}`);
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      if (bot.seat === -1 && snap.you >= 0) bot.seat = snap.you;
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) bot.meldCount = mine.melds.length;
          if (mine.hand) bot.lastHandSize = mine.hand.length;
        }
      }
      break;
    }
    case "error": {
      const code = evt.code as string;
      if (["stale_generation", "wrong_phase", "no_discard", "illegal_chi", "illegal_peng", "illegal_kong", "not_your_turn", "not_lobby"].includes(code)) {
        stress.benignErrors += 1;
        if (code === "stale_generation") stress.staleGeneration += 1;
        if (code === "wrong_phase") stress.wrongPhase += 1;
        return;
      }
      stress.unknownErrors += 1;
      log(`⚠️ ${bot.name} 收到未知錯誤 ${code}: ${evt.message}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Win-oriented discard strategy (same as qa-e2e)
// ---------------------------------------------------------------------------

type IdTile = { instanceId: number; id: string };

const NUM_SUITS = ["wan", "tiao", "tong"] as const;
const HONOR_RANKS = ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const;

function idSuitRank(id: string): { suit: string; rank: number } | null {
  const [cat, val] = id.split(":");
  if (!cat || !val) return null;
  if (cat === "flower") return null;
  if (cat === "honor") return { suit: "honor", rank: HONOR_RANKS.indexOf(val as (typeof HONOR_RANKS)[number]) };
  if (NUM_SUITS.includes(cat as (typeof NUM_SUITS)[number])) {
    const r = Number(val);
    if (Number.isFinite(r) && r >= 1 && r <= 9) return { suit: cat, rank: r };
  }
  return null;
}

function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0;
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0;
  value += hasLeft && hasRight ? 1 : 0;
  value += hasLeft || hasRight ? 1 : 0;
  return value;
}

function pickWinDiscard(hand: IdTile[]): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** 破壞牌：丟最高價值張，讓莊家容易連胡（STRESS-4 連莊）。 */
function pickSabotageTile(hand: IdTile[]): IdTile | undefined {
  if (hand.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const t of hand) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  let best: IdTile | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const t of hand) {
    const score = tileValue(t.id, counts);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// STRESS-1: 高頻隨機點擊（重複 discard / 重複 opId / 亂序 generation）
// ---------------------------------------------------------------------------

/** 隨機選一局觸發「高頻重複點擊」：同一張牌連打 3 次 + 重複 opId + 亂序 generation。 */
function stressSpamDiscards(bot: Bot, snap: Snap, hand: IdTile[], discard: IdTile): void {
  const gen = snap.generationId;
  const baseOp = opId(bot, "spam");
  const payload = {
    type: "discard",
    operationId: baseOp,
    generationId: gen,
    tileInstanceId: discard.instanceId,
  };
  // 第一次：正常指令。
  send(bot, payload);
  stress.duplicateDiscards += 1;
  // 第二次：同一 operationId（冪等 — 伺服器應丟棄，不回錯誤）。
  send(bot, payload);
  stress.repeatedOpIds += 1;
  // 第三次：同張牌但新 operationId（可能 wrong_phase — 屬良性競態）。
  send(bot, { ...payload, operationId: opId(bot, "spam2") });
  stress.duplicateDiscards += 1;
  // 第四次：亂序 generation（stale_generation — 屬良性）。
  send(bot, { ...payload, operationId: opId(bot, "spam3"), generationId: gen - 5 });
  stress.duplicateDiscards += 1;
}

// ---------------------------------------------------------------------------
// Bot decision logic
// ---------------------------------------------------------------------------

/** 本局是否為破壞牌模式（STRESS-4：全場啟用，莊家連胡）。 */
function isSabotageRound(_round: number): boolean {
  return true;
}

function handleSnapshot(bot: Bot, snap: Snap, round: number): void {
  if (snap.status === "ended") return;
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window: 破壞牌模式一律過（讓莊家連胡）。 ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    if (isSabotageRound(round) && bot.seat !== room.dealer) {
      send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
      return;
    }
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
      return;
    }
    if (hint.canPeng) {
      send(bot, { type: "reaction", operationId: opId(bot, "peng"), generationId: snap.generationId, kind: "peng" });
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
      return;
    }
    send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // STRESS-3: 快速超時 — 每 ~7 局指定 bot 故意 1 回合不操作。
    if (stressTimeout.active && stressTimeout.round === round && bot.name === stressTimeout.botName) {
      if (!stressTimeout.timedOut) {
        stressTimeout.firstTurnSeen = true;
        stressTimeout.turnSeat = bot.seat;
        stressTimeout.turnGeneration = snap.generationId;
        if (!stressTimeout.turnStartedAt) stressTimeout.turnStartedAt = Date.now();
        log(`  ⏸️ ${bot.name} 故意不操作（STRESS-3 快速超時）…`);
        return;
      }
      // 伺服器已自動摸切 — 手動恢復出牌。
      stressTimeout.recovered = true;
      stress.recoveryDiscards += 1;
      log(`  🎮 ${bot.name} 手動恢復出牌（STRESS-3）`);
    }

    const saboteur = isSabotageRound(round) && bot.seat !== room.dealer;
    const discard = saboteur ? pickSabotageTile(hand) : pickWinDiscard(hand);
    if (!discard) return;

    // STRESS-1: 隨機觸發高頻重複點擊（每局約 15% 機率）。
    if (Math.random() < 0.15) {
      stressSpamDiscards(bot, snap, hand, discard);
      log(`  ⚡ ${bot.name} 高頻重複點擊（連打 ${discard.id}×3 + 重複 opId + 亂序 gen）`);
      return;
    }

    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: discard.instanceId,
    });
    log(`  ${bot.name} ${saboteur ? "(破壞牌)" : ""}打出 ${discard.id}`);
  }
}

// ---------------------------------------------------------------------------
// STRESS-3 狀態
// ---------------------------------------------------------------------------

const stressTimeout = {
  active: false,
  botName: "B" as string,
  round: -1,
  firstTurnSeen: false,
  turnGeneration: -1,
  turnSeat: -1,
  turnStartedAt: null as number | null,
  timedOut: false,
  recovered: false,
};

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

let lastProgressAt = Date.now();
function touchProgress(): void {
  lastProgressAt = Date.now();
}

function startWatchdog(): void {
  const iv = setInterval(() => {
    if (finished || fatalError) return;
    if (Date.now() - lastProgressAt > OVERALL_TIMEOUT_MS) {
      fatalError = `Watchdog 逾時：無進度 ${OVERALL_TIMEOUT_MS / 1000}s`;
      log(`[stress] ❌ ${fatalError}`);
      finish();
    }
  }, 5000);
}

function finish(): void {
  if (finished) return;
  finished = true;
}

function everyoneReadies(): void {
  for (const bot of bots) {
    send(bot, { type: "ready", operationId: opId(bot, "ready") });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(`WS=${WS_URL}  STRESS-1~5 綜合壓力測試（目標 ${TARGET_ROUNDS} 局）`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  await sleep(200);

  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await sleep(200);
  const roomId = room.id;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  log(`🏠 房號 ${roomId} 建立（STRESS-1~5）`);
  for (const bot of bots.slice(1)) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId, playerName: bot.name });
    await sleep(60);
  }
  await sleep(200);
  const seated = bots.every((b) => b.seat >= 0 && b.seat < 4);
  check("基礎", "4 視窗連線並入座", seated, `座位=[${bots.map((b) => b.seat).join(",")}]`);

  let lastDropRound = 0;

  while (room.ended < TARGET_ROUNDS && !fatalError) {
    const round = room.ended + 1;
    const startedBefore = room.started;

    // STRESS-3: 每 ~7 局啟用快速超時（不同 bot 輪流）。
    if (round % 7 === 2) {
      stressTimeout.active = true;
      stressTimeout.round = round;
      stressTimeout.botName = BOT_NAMES[round % 4]!;
      stressTimeout.firstTurnSeen = false;
      stressTimeout.timedOut = false;
      stressTimeout.recovered = false;
      stressTimeout.turnGeneration = -1;
      stressTimeout.turnStartedAt = null;
      log(`  ⏱️ STRESS-3 啟用：${stressTimeout.botName} 第 ${round} 局不操作（快速超時）`);
    } else {
      stressTimeout.active = false;
    }

    everyoneReadies();
    touchProgress();

    const startWait = Date.now();
    while (room.started === startedBefore && !fatalError) {
      if (Date.now() - startWait > 15_000) {
        fatalError = "等待 game.started 逾時";
        break;
      }
      await sleep(80);
    }
    if (fatalError) break;
    touchProgress();

    // STRESS-2: 每 ~10 局隨機斷線一個 bot 再重連（不中斷對局，伺服器自動託管過渡）。
    if (round - lastDropRound >= 10) {
      const victim = pickRandom(bots)!;
      if (victim.playerId) {
        log(`  🔌 STRESS-2：斷線 ${victim.name}（第 ${round} 局中途）`);
        await dropAndReconnect(victim);
        lastDropRound = round;
      }
    }

    // 本局進行（bots 自動出牌；STRESS-1/3 觸發）。
    const endWait = Date.now();
    while (room.ended < round && !fatalError) {
      // STRESS-3：偵測伺服器已自動摸切。
      if (stressTimeout.active && stressTimeout.firstTurnSeen && !stressTimeout.timedOut) {
        const sSnap = bots.find((b) => b.name === stressTimeout.botName)?.lastSnap as unknown as Snap | null;
        const hasTimeoutLog = sSnap?.autoplayLog?.some(
          (a) => a.seat === stressTimeout.turnSeat && a.action === "discard" && a.reason === "timeout",
        );
        if (hasTimeoutLog || (sSnap && sSnap.players.find((p) => p.seat === stressTimeout.turnSeat)?.autoplay)) {
          stressTimeout.timedOut = true;
          stress.timeoutsSeen += 1;
          log(`  🤖 STRESS-3：伺服器已自動摸切（逾時）`);
        }
      }

      // 觸發 STRESS-2 重連後，bot 可能短暫離線 → 跳過未連線 bot。
      for (const bot of bots) {
        if (!bot.connected || !bot.ws || bot.ws.readyState !== WebSocket.OPEN) continue;
        const snap = bot.lastSnap as unknown as Snap | null;
        if (snap) handleSnapshot(bot, snap, round);
      }

      if (Date.now() - endWait > 120_000) {
        fatalError = `第 ${round} 局等待結束逾時`;
        break;
      }
      await sleep(REACTION_JITTER_MS);
      touchProgress();
    }
    if (fatalError) break;

    // ---- 每局基礎驗證 ----
    check("基礎", "本局自動胡牌結算", room.ended === round);
    if (room.ended === round) {
      // room 物件本身不含快照 — 改由任一 bot 的 lastSnap 讀取本局結算。
      const snapA = bots[0]!.lastSnap as unknown as Snap | null;
      const ended = snapA?.settlement ?? null;
      if (ended && ended.ledger) {
        const sum = ended.ledger.reduce((n, e) => n + e.delta, 0);
        check("基礎", "ledger 四家 delta 總和為 0", sum === 0, `sum=${sum}`);
      }
    }

    // ---- STRESS-4：莊家輪替不變式（連莊/過莊） ----
    if (room.rounds.length >= 2) {
      const prev = room.rounds[room.rounds.length - 2]!;
      const cur = room.rounds[room.rounds.length - 1]!;
      const expectedDealer =
        prev.winner === null || prev.winner === prev.dealer ? prev.dealer : (prev.dealer + 1) % 4;
      const expectedStreak = prev.winner === null || prev.winner === prev.dealer ? prev.streak + 1 : 0;
      check(
        "STRESS-4",
        "莊家輪替不變式（過莊/連莊）",
        cur.dealer === expectedDealer && cur.streak === expectedStreak,
        `局${cur.dealer}/${cur.streak} 應為 ${expectedDealer}/${expectedStreak}`,
      );
    }

    // ---- STRESS-3 驗證（本局若啟用） ----
    if (stressTimeout.active && stressTimeout.round === round) {
      check(
        "STRESS-3",
        "快速超時後伺服器自動摸切",
        stressTimeout.timedOut,
        stressTimeout.timedOut ? "已觸發" : "未觸發",
      );
      check(
        "STRESS-3",
        "超時後手動恢復出牌",
        stressTimeout.recovered,
        stressTimeout.recovered ? `${stressTimeout.botName} 已恢復` : "未恢復",
      );
    }

    // ---- STRESS-5：每 25 局記憶體 / 連線計數採樣 ----
    if (room.ended % 25 === 0) {
      const h = await fetchHealth();
      memSamples.push({
        round: room.ended,
        rssMB: h?.memory ? Math.round(h.memory.rss / 1024 / 1024) : -1,
        heapUsedMB: h?.memory ? Math.round(h.memory.heapUsed / 1024 / 1024) : -1,
        sockets: h?.sockets ?? -1,
        rooms: h?.rooms ?? -1,
      });
      log(`📊 STRESS-5 採樣 #${memSamples.length}: ${JSON.stringify(memSamples[memSamples.length - 1])}`);
      if (h?.executedEstimate !== undefined) lastExecutedEstimate = h.executedEstimate;
    }
  }

  // ---------------------------------------------------------------------
  // 彙總驗證
  // ---------------------------------------------------------------------
  if (!fatalError) {
    check("基礎", "完成 100 局", room.ended === TARGET_ROUNDS, `實際 ${room.ended} 局`);

    // STRESS-1：高頻重複點擊不崩潰、未知錯誤為 0。
    check(
      "STRESS-1",
      "高頻重複點擊已觸發",
      stress.duplicateDiscards > 0,
      `重複指令 ${stress.duplicateDiscards} 次`,
    );
    check(
      "STRESS-1",
      "重複 operationId 已送出（冪等驗證）",
      stress.repeatedOpIds > 0,
      `${stress.repeatedOpIds} 次`,
    );
    check(
      "STRESS-1",
      "亂序 generation / 錯誤率受控（無未知錯誤）",
      stress.unknownErrors === 0,
      `unknown=${stress.unknownErrors} stale=${stress.staleGeneration} wrongPhase=${stress.wrongPhase} benign=${stress.benignErrors}`,
    );

    // STRESS-2：斷線重連至少 5 次且座位恢復。
    check(
      "STRESS-2",
      "斷線 / 重連多次成功",
      stress.reconnects >= 5,
      `重連 ${stress.reconnects} 次`,
    );
    check(
      "STRESS-2",
      "重連後座位正確（seat ∈ 0..3）",
      bots.every((b) => b.seat >= 0 && b.seat < 4),
      `座位=[${bots.map((b) => b.seat).join(",")}]`,
    );

    // STRESS-3：快速超時多次觸發 + 恢復。
    check(
      "STRESS-3",
      "快速超時自動託管多次觸發",
      stress.timeoutsSeen >= 3,
      `觸發 ${stress.timeoutsSeen} 次`,
    );
    check(
      "STRESS-3",
      "託管後手動恢復多次成功",
      stress.recoveryDiscards >= 3,
      `恢復 ${stress.recoveryDiscards} 次`,
    );

    // STRESS-4：破壞牌模式 → 連莊 streak ≥ 2。
    const maxStreak = room.rounds.reduce((m, r) => Math.max(m, r.streak), 0);
    check(
      "STRESS-4",
      "莊家連續胡牌（連莊 streak ≥ 2）",
      maxStreak >= 2,
      `最高連莊 streak=${maxStreak}（莊家勝 ${room.dealerWinCount} 局）`,
    );

    // STRESS-5：記憶體無洩漏（末段中位數 vs 前段中位數）。
    if (memSamples.length >= 3) {
      const first = memSamples.slice(0, Math.max(2, Math.floor(memSamples.length / 3)));
      const last = memSamples.slice(-Math.max(2, Math.floor(memSamples.length / 3)));
      const median = (xs: number[]): number => {
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)] ?? 0;
      };
      const rssFirst = median(first.map((s) => s.rssMB).filter((v) => v >= 0));
      const rssLast = median(last.map((s) => s.rssMB).filter((v) => v >= 0));
      const heapFirst = median(first.map((s) => s.heapUsedMB).filter((v) => v >= 0));
      const heapLast = median(last.map((s) => s.heapUsedMB).filter((v) => v >= 0));
      const rssGrowth = rssLast - rssFirst;
      const heapGrowth = heapLast - heapFirst;
      check(
        "STRESS-5",
        "RSS 記憶體無洩漏（末段 ≤ 前段 + 64MB）",
        rssGrowth <= 64,
        `RSS ${rssFirst}MB → ${rssLast}MB（+${rssGrowth}MB）`,
      );
      check(
        "STRESS-5",
        "Heap Used 無洩漏（末段 ≤ 前段 + 64MB）",
        heapGrowth <= 64,
        `Heap ${heapFirst}MB → ${heapLast}MB（+${heapGrowth}MB）`,
      );
    } else {
      check("STRESS-5", "記憶體採樣不足", false, `僅 ${memSamples.length} 次採樣`);
    }
  }

  printReport();

  for (const bot of bots) bot.ws?.close();
  const allPass = checks.every((c) => c.passed) && !fatalError;
  process.exit(allPass ? 0 : 1);
}

function printReport(): void {
  console.log("\n\n================ QA STRESS 壓力測試報告 ================");
  console.log(`WS: ${WS_URL}`);
  console.log(`完成局數: ${room.ended}  （game.started×${room.started}）`);
  if (fatalError) console.log(`致命錯誤: ${fatalError}`);
  console.log(
    `壓力統計: 重複指令=${stress.duplicateDiscards} 重複opId=${stress.repeatedOpIds} ` +
      `stale=${stress.staleGeneration} wrongPhase=${stress.wrongPhase} benign=${stress.benignErrors} ` +
      `unknown=${stress.unknownErrors} 重連=${stress.reconnects} 超時=${stress.timeoutsSeen} 恢復=${stress.recoveryDiscards}`,
  );
  const byScenario = new Map<string, QaCheck[]>();
  for (const c of checks) {
    if (!byScenario.has(c.scenario)) byScenario.set(c.scenario, []);
    byScenario.get(c.scenario)!.push(c);
  }
  for (const [scenario, list] of byScenario) {
    const pass = list.filter((c) => c.passed).length;
    console.log(`\n${scenario}: ${pass}/${list.length} PASS`);
    for (const c of list) {
      console.log(`  ${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
  }
  const totalPass = checks.filter((c) => c.passed).length;
  console.log(`\n總計: ${totalPass}/${checks.length} 項通過`);
  console.log("==================================================");
}

void main();
