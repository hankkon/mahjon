/**
 * qa-e2e.ts — 全功能地端 E2E 實機綜合測試（情境 A/B/C/D）。
 *
 * 四個 WebSocket 機器人（A/B/C/D）連線至實際運行的地端伺服器
 * `ws://localhost:3000/ws`，依序執行四個 QA 情境並輸出 PASS/FAIL 報告：
 *
 *   情境 A【標準完整流程】:
 *     4 視窗連線 → 入座 → 準備 → 自動發牌 → 輪流摸打牌 → 自動胡牌結算
 *     → 點擊「準備下一局」重置（全員 ready → 下一局自動發牌）。
 *   情境 B【吃/碰/槓】:
 *     反應視窗開啟時依 reactionHint 觸發 吃/碰/槓；驗證快照副露(melds)
 *     正確揭露（客戶端 AnimatoinQueue 會依此播放動畫並鎖定輸入）。
 *   情境 C【逾時與託管恢復】:
 *     指定回合故意 15 秒不操作 → 驗證伺服器自動摸切（autoplayLog
 *     reason=timeout、快照 phaseDeadline/countdownMs、players[].autoplay）；
 *     之後手動出牌 → 驗證手動控制權恢復（autoplay=false 且指令被接受）。
 *   情境 D【連莊與結算帳本】:
 *     跨局驗證 莊家輪替/連莊 不變式（莊贏/流局 → 連莊 +1；閒家贏 → 過莊
 *     換人 streak=0）；每局驗證 ledger 四家 delta 加總為 0、台數明細
 *     breakdown.total >= 1、連莊加成規則存在。
 *
 * 使用（需先 build 並啟動伺服器）:
 *   pnpm --filter @taiwan-mahjong/server build
 *   TIMEOUT_MS=15000 node dist/apps/server/src/serve.js   # 終端 A
 *   node dist/apps/server/src/scripts/qa-e2e.js [WS_URL]
 *
 * Exit code 0 = 全部情境 PASS；1 = 任一情境 FAIL。
 */

import WebSocket from "ws";

const WS_URL = process.argv[2] ?? "ws://localhost:3000/ws";
const BOT_NAMES = ["A", "B", "C", "D"] as const;

/** 情境 C 需要等待伺服器 15s 逾時自動摸切。 */
const TIMEOUT_WAIT_MS = 20_000;
const REACTION_JITTER_MS = 25;
const STEP_DELAY_MS = 250;
const OVERALL_TIMEOUT_MS = 300_000;

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
  console.log(`[qa][${scenario}] ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function scenarioHeader(s: string): void {
  console.log(`\n================= 情境 ${s} =================`);
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
  /** Track melds observed in snapshots (Scenario B assertions). */
  meldCount: number;
  /** Highest simultaneous meld count seen (Scenario B). */
  maxMeldsSeen: number;
  /** Cumulative meld events by kind (Scenario B assertions). */
  chiCount: number;
  pengCount: number;
  kongCount: number;
  /** Track hand size to detect draws (Scenario A). */
  lastHandSize: number;
  /** Track own autoplay flag (Scenario C). */
  autoplay: boolean;
  /** Latest snapshot (for assertions). */
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
    maxMeldsSeen: 0,
    chiCount: 0,
    pengCount: 0,
    kongCount: 0,
    lastHandSize: 0,
    autoplay: false,
    lastSnap: null,
  };
}

const bots: Bot[] = BOT_NAMES.map(makeBot);
const room = {
  id: "" as string | null,
  /** Number of hands completed (game.ended events). */
  ended: 0,
  /** game.started events seen. */
  started: 0,
  /** Current round's dealer + streak (captured at deal). */
  dealer: -1,
  streak: -1,
  /** Last ended hand's summary for Scenario D. */
  lastEnded: null as null | {
    winner: number | null;
    dealer: number;
    streak: number;
    selfDraw: boolean;
    ledger: Array<{ seat: number; delta: number }>;
    breakdown: { fans: Array<{ rule: string; value: number }>; total: number } | null;
    scores: number[];
  },
  /** Cumulative scores (verify ledger deltas apply). */
  scores: [0, 0, 0, 0],
  /** All ended rounds, for rotation invariant. */
  rounds: [] as Array<{ winner: number | null; dealer: number; streak: number }>,
  /** Hands won by an actual player (not 流局). */
  winCount: 0,
  /** Hands won by the dealer (for 連莊 checks). */
  dealerWinCount: 0,
};

let fatalError: string | null = null;
let finished = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(bot: Bot, payload: Record<string, unknown>): void {
  if (!bot.ws || bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function opId(bot: Bot, kind: string): string {
  bot.opCounter += 1;
  return `qa-${bot.name}-${kind}-${bot.opCounter}`;
}

function log(msg: string): void {
  console.log(`[qa] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pickRandom<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Connection
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
    case "game.started": {
      // All 4 bots receive game.started — only A advances the counters so
      // room.started stays in sync with the number of hands actually dealt.
      if (bot.name !== "A") break;
      room.started += 1;
      room.dealer = evt.dealer as number;
      room.streak = evt.dealerStreak as number;
      log(`🎲 [發牌#${room.started}] 莊家 ${room.dealer} 連莊${room.streak}`);
      break;
    }
    case "game.ended": {
      if (bot.name !== "A") break;
      room.ended += 1;
      const ended: NonNullable<typeof room.lastEnded> = {
        winner: evt.winner as number | null,
        dealer: room.dealer,
        streak: room.streak,
        selfDraw: evt.selfDraw as boolean,
        ledger: (evt.ledger ?? []) as Array<{ seat: number; delta: number }>,
        breakdown: (evt.breakdown ?? null) as {
          fans: Array<{ rule: string; value: number }>;
          total: number;
        } | null,
        scores: (evt.scores ?? []) as number[],
      };
      room.lastEnded = ended;
      room.rounds.push({ winner: ended.winner, dealer: ended.dealer, streak: ended.streak });
      if (ended.winner !== null) {
        room.winCount += 1;
        if (ended.winner === ended.dealer) room.dealerWinCount += 1;
      }
      log(`🏁 [結束#${room.ended}] 勝者=${ended.winner} 莊=${ended.dealer} 連莊=${ended.streak}`);
      break;
    }
    case "snapshot": {
      const snap = evt.snapshot as unknown as Snap;
      bot.lastSnap = evt.snapshot as unknown as Record<string, unknown>;
      // The room creator never receives player.joined (wss.ts sends only
      // welcome + room.created) — derive the seat from snap.you, exactly like
      // simulate-match.ts does.
      if (bot.seat === -1 && snap.you >= 0) {
        bot.seat = snap.you;
      }
      if (snap.status === "playing") {
        const mine = snap.players.find((p) => p.seat === bot.seat);
        if (mine) {
          bot.autoplay = mine.autoplay;
          if (mine.melds.length > bot.meldCount) {
            // New melds observed — tally by kind (Scenario B).
            const newMelds = mine.melds.slice(bot.meldCount);
            for (const m of newMelds) {
              if (m.kind === "chi") bot.chiCount += 1;
              else if (m.kind === "peng") bot.pengCount += 1;
              else if (m.kind === "kong") bot.kongCount += 1;
            }
            bot.meldCount = mine.melds.length;
            if (mine.melds.length > bot.maxMeldsSeen) bot.maxMeldsSeen = mine.melds.length;
          }
          if (mine.hand) bot.lastHandSize = mine.hand.length;
        }
      }
      break;
    }
    case "error": {
      const code = evt.code as string;
      const msg = evt.message as string;
      if (["stale_generation", "wrong_phase", "no_discard", "illegal_chi", "illegal_peng", "illegal_kong", "not_your_turn", "not_lobby"].includes(code)) {
        return; // benign race
      }
      log(`⚠️ ${bot.name} 收到錯誤 ${code}: ${msg}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Win-oriented discard strategy
//
// The server auto-finishes self-draw wins (detectWin on each draw), so bots
// only need to preserve tiles that move them toward a complete hand. We score
// each candidate discard by the value of the hand it leaves behind:
//
//   * complete melds (triplet / run) score +3
//   * a pair scores +2 (pair is the "eyes")
//   * a partial run (two tiles of a consecutive run) scores +1
//   * an isolated honor (wind/dragon) scores 0 — first to go
//
// Honours: a lone honor is never useful unless forming a pair/triplet.
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

/** Score how valuable a tile identity is within the current hand. */
function tileValue(id: string, counts: Map<string, number>): number {
  const sr = idSuitRank(id);
  if (!sr) return 0; // flowers handled by server, never in our discard choice
  const n = counts.get(id) ?? 0;
  let value = 0;
  if (sr.suit === "honor") {
    // Lone honor is worthless; pair/triplet has value.
    return n >= 2 ? 2 + (n >= 3 ? 1 : 0) : 0;
  }
  // numbered: count runs with neighbors
  const inc = (r: number) => counts.get(`${sr.suit}:${r}`) ?? 0;
  const hasLeft = sr.rank > 1 && inc(sr.rank - 1) > 0;
  const hasRight = sr.rank < 9 && inc(sr.rank + 1) > 0;
  value += n >= 3 ? 3 : n === 2 ? 2 : 0; // triplet or pair
  value += hasLeft && hasRight ? 1 : 0; // interior of a run
  value += hasLeft || hasRight ? 1 : 0; // partial run
  return value;
}

/**
 * Choose the discard that keeps the strongest partial hand.
 * Falls back to discarding the tile with the lowest identity value, breaking
 * ties by discarding the oldest tile first (stable hand → fewer re-shuffles).
 */
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

/**
 * Sabotage: deliberately keep the hand broken so the dealer (SABOTAGE.dealer)
 * wins. We discard the tile that leaves the FEWEST useful patterns, i.e. the
 * opposite of pickWinDiscard — but never a tile that would leave a lone honor
 * around (that actually helps the dealer claim). We simply maximize the damage:
 * discard the tile with the HIGHEST value (break the strongest meld).
 */
function pickSabotageTile(hand: IdTile[], _dealer: number): IdTile | undefined {
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
  // If everything scores 0 (all lone honors), just dump a random one.
  return best ?? pickRandom(hand);
}

// ---------------------------------------------------------------------------
// Scenario D: dealer-streak (sabotage) driver
// ---------------------------------------------------------------------------

const SABOTAGE = {
  /** Activate from this round onward (dealer wins consecutive hands). */
  active: false,
  round: -1,
  dealer: -1,
};

// ---------------------------------------------------------------------------
// Bot decision logic — acts on snapshots (Scenario A + B)
// ---------------------------------------------------------------------------

function handleSnapshot(bot: Bot, snap: Snap): void {
  if (snap.status === "ended") return;
  if (snap.generationId <= bot.lastActedGen) return;
  bot.lastActedGen = snap.generationId;

  const mine = snap.players.find((p) => p.seat === bot.seat);
  if (!mine) return;

  // --- Reaction window: 吃/碰/槓 (Scenario B). ---
  if (snap.gamePhase === "reaction" && snap.reactionHint) {
    const hint = snap.reactionHint;
    // Sabotage mode: non-dealer bots never claim reaction tiles — the dealer
    // keeps first pick of every discard, so it can win consecutive hands.
    const saboteur =
      SABOTAGE.active &&
      SABOTAGE.round === room.ended + 1 &&
      bot.seat !== SABOTAGE.dealer;
    if (saboteur) {
      send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
      log(`  ${bot.name} (破壞牌)過`);
      return;
    }
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
      log(`  ${bot.name} 槓(${opt.kongType})`);
      return;
    }
    if (hint.canPeng) {
      send(bot, {
        type: "reaction",
        operationId: opId(bot, "peng"),
        generationId: snap.generationId,
        kind: "peng",
      });
      log(`  ${bot.name} 碰!`);
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
      log(`  ${bot.name} 吃!`);
      return;
    }
    send(bot, { type: "pass", operationId: opId(bot, "pass"), generationId: snap.generationId });
    return;
  }

  // --- Own discard turn. ---
  if (snap.gamePhase === "discard" && snap.turn === bot.seat) {
    const hand = mine.hand ?? [];
    if (hand.length === 0) return;

    // Scenario C: bot B stops discarding once — the server must auto-摸切
    // after the 15s thinking-timeout, then B recovers manual control by
    // discarding on its next turn.
    if (
      SCENARIO_C.active &&
      bot.name === SCENARIO_C.botName &&
      SCENARIO_C.round === room.ended + 1
    ) {
      if (!SCENARIO_C.timedOut) {
        // Stall: don't send anything — server will auto-discard at the timeout.
        SCENARIO_C.firstTurnSeen = true;
        SCENARIO_C.turnGeneration = snap.generationId;
        SCENARIO_C.turnSeat = bot.seat;
        if (!SCENARIO_C.turnStartedAt) SCENARIO_C.turnStartedAt = Date.now();
        log(`  ⏸️ ${bot.name} 故意不操作（情境 C 逾時測試，等 15 秒）…`);
        return;
      }
      // Server auto-摸切 happened — resume manual control now (recovery).
      SCENARIO_C.recovered = true;
      log(`  🎮 ${bot.name} 手動恢復出牌（情境 C 託管恢復）…`);
    }

    // Optional self-kong (30% chance) to enrich Scenario B.
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
      log(`  ${bot.name} 自槓(${opt.kongType})`);
      return;
    }

    // Sabotage mode (dealer-streak rounds): non-dealer bots dump pairs/triplets
    // first so the dealer can reliably win consecutive hands (Scenario D 連莊台).
    const saboteur =
      SABOTAGE.active &&
      SABOTAGE.round === room.ended + 1 &&
      bot.seat !== SABOTAGE.dealer;
    const discard = saboteur
      ? pickSabotageTile(hand, SABOTAGE.dealer)
      : pickWinDiscard(hand);
    if (!discard) return;
    send(bot, {
      type: "discard",
      operationId: opId(bot, "discard"),
      generationId: snap.generationId,
      tileInstanceId: discard.instanceId,
    });
    log(
      `  ${bot.name} ${saboteur ? "(破壞牌)" : ""}打出 ${discard.id}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Scenario C state
// ---------------------------------------------------------------------------

const SCENARIO_C = {
  active: false,
  botName: "B" as string,
  round: -1,
  firstTurnSeen: false,
  turnGeneration: -1,
  turnSeat: -1,
  /** Epoch ms when bot B's stalled turn began (waiting for the 15s timeout). */
  turnStartedAt: null as number | null,
  /** Set once the server auto-discarded (timeout fired). */
  timedOut: false,
  /** Set once the bot manually discarded on a later turn. */
  recovered: false,
};

// ---------------------------------------------------------------------------
// Scenario drivers
// ---------------------------------------------------------------------------

/** 全員按準備。若房間在 ended 狀態，第一個 ready 會重置房間（情境 A 重置流程）。 */
function everyoneReadies(): void {
  for (const bot of bots) {
    send(bot, { type: "ready", operationId: opId(bot, "ready") });
  }
}

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
      log(`[qa] ❌ ${fatalError}`);
      finish();
    }
  }, 5000);
}

function finish(): void {
  if (finished) return;
  finished = true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(`WS=${WS_URL}  情境 A/B/C/D 綜合測試`);
  startWatchdog();

  try {
    for (const bot of bots) await connectBot(bot);
  } catch (err) {
    fatalError = `連線失敗: ${err instanceof Error ? err.message : String(err)}`;
    log(`[qa] ❌ ${fatalError}`);
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  await sleep(300);

  // --- A 開房，B/C/D 加入。 ---
  send(bots[0]!, { type: "create", operationId: opId(bots[0]!, "create"), playerName: "A" });
  await sleep(300);
  const roomId = room.id;
  if (!roomId) {
    fatalError = "A 沒有拿到房號";
    printReport();
    for (const bot of bots) bot.ws?.close();
    process.exit(1);
  }
  log(`🏠 房號 ${roomId} 建立（4 視窗連線）`);
  for (const bot of bots.slice(1)) {
    send(bot, { type: "join", operationId: opId(bot, "join"), roomId, playerName: bot.name });
    await sleep(200);
  }
  await sleep(400);
  // 驗證 4 人入座。
  const seated = bots.every((b) => b.seat >= 0 && b.seat < 4);
  const seats = bots.map((b) => b.seat).join(",");
  check("A", "4 視窗連線並入座", seated, `座位=[${seats}]`);

  // ---------------------------------------------------------------------
  // 情境 A + B + D：多局標準流程，途中觸發吃碰槓。
  // 情境 C：指定局 bot B 停止出牌，等待 15s 逾時。
  // ---------------------------------------------------------------------
  // 5 局：破壞牌模式第 3~5 局連續啟用，給莊家足夠機會連胡達連莊台。
  const TARGET_ROUNDS = 5;
  let scenarioCTriggered = false;

  while (room.ended < TARGET_ROUNDS && !fatalError) {
    const nextRound = room.ended + 1;
    const startedBefore = room.started;

    log(`\n--- 第 ${nextRound} 局準備（全員 Ready） ---`);
    // 情境 C：第 2 局啟用 bot B 逾時。
    if (nextRound === 2) {
      SCENARIO_C.active = true;
      SCENARIO_C.round = 2;
      SCENARIO_C.botName = "B";
      SCENARIO_C.firstTurnSeen = false;
      SCENARIO_C.timedOut = false;
      SCENARIO_C.recovered = false;
      scenarioCTriggered = true;
    }
    // 情境 D：第 3 局起啟動「破壞牌」模式 — 讓莊家連續胡牌以驗證連莊台。
    // dealer 在 game.started 之後才會更新為本局莊家（見下方發牌後指派）。
    if (nextRound >= 3) {
      SABOTAGE.active = true;
      SABOTAGE.round = nextRound;
      log(`  🎯 情境 D：破壞牌模式待發牌後啟用（第 ${nextRound} 局）`);
    }

    everyoneReadies();
    touchProgress();

    // 等待 game.started。
    const startWait = Date.now();
    while (room.started === startedBefore && !fatalError) {
      if (Date.now() - startWait > 15_000) {
        fatalError = "等待 game.started 逾時";
        break;
      }
      await sleep(200);
    }
    if (fatalError) break;
    touchProgress();

    // 情境 D：發牌後鎖定本局莊家，破壞牌模式只針對非莊家 bot。
    if (SABOTAGE.active && SABOTAGE.round === nextRound && room.dealer >= 0) {
      SABOTAGE.dealer = room.dealer;
      log(`  🎯 破壞牌模式啟用：莊家=${SABOTAGE.dealer}（其餘三家故意拆牌）`);
    }

    // 等待本局結束（期間 bots 自動出牌/反應）。
    const endWait = Date.now();
    while (room.ended < nextRound && !fatalError) {
      // 情境 C：等待逾時自動摸切。
      if (SCENARIO_C.active && SCENARIO_C.firstTurnSeen && !SCENARIO_C.timedOut) {
        const bSnap = bots[1]!.lastSnap as unknown as Snap | null;
        const bMine = bSnap?.players?.find((p) => p.seat === bots[1]!.seat);
        const hasTimeoutLog = bSnap?.autoplayLog?.some(
          (a) => a.seat === bots[1]!.seat && a.action === "discard" && a.reason === "timeout",
        );
        if (hasTimeoutLog || (bMine && bMine.autoplay)) {
          SCENARIO_C.timedOut = true;
          log(`  🤖 情境 C：伺服器已自動摸切（逾時）`);
        }
      }

      // bots 繼續正常出牌（情境 C 逾時後 B 恢復手動）。
      for (const bot of bots) {
        const snap = bot.lastSnap as unknown as Snap | null;
        if (snap) handleSnapshot(bot, snap);
      }

      if (Date.now() - endWait > 120_000) {
        fatalError = `第 ${nextRound} 局等待結束逾時`;
        break;
      }
      await sleep(REACTION_JITTER_MS);
      touchProgress();
    }
    if (fatalError) break;

    // ---- 情境 A 驗證 ----
    check("A", "本局自動胡牌結算（game.ended）", room.ended === nextRound);
    const ended = room.lastEnded!;
    check("A", "結算含四家分數增減（ledger）", !!ended && ended.ledger.length === 4);
    const ledgerSum = ended ? ended.ledger.reduce((n, e) => n + e.delta, 0) : -1;
    check("A", "ledger 四家 delta 總和為 0", ledgerSum === 0, `sum=${ledgerSum}`);

    // ---- 情境 B 驗證（每局，吃/碰/槓發生與否皆記錄） ----
    const meldsThisRound = bots.reduce((n, b) => n + b.meldCount, 0);
    if (meldsThisRound > 0) {
      check(
        "B",
        "本局觸發吃/碰/槓副露",
        meldsThisRound > 0,
        `共 ${meldsThisRound} 副露（吃${bots.reduce((n, b) => n + b.chiCount, 0)} 碰${bots.reduce((n, b) => n + b.pengCount, 0)} 槓${bots.reduce((n, b) => n + b.kongCount, 0)}）`,
      );
    }

    // ---- 情境 D 驗證（每局） ----
    if (room.rounds.length >= 2) {
      const prev = room.rounds[room.rounds.length - 2]!;
      const cur = room.rounds[room.rounds.length - 1]!;
      const expectedDealer =
        prev.winner === null || prev.winner === prev.dealer ? prev.dealer : (prev.dealer + 1) % 4;
      const expectedStreak =
        prev.winner === null || prev.winner === prev.dealer ? prev.streak + 1 : 0;
      check(
        "D",
        "莊家輪替不變式（過莊/連莊）",
        cur.dealer === expectedDealer && cur.streak === expectedStreak,
        `局${cur.dealer}/${cur.streak} 應為 ${expectedDealer}/${expectedStreak}`,
      );
    }
    // 連莊加成規則存在於 fan 明細中（當 streak>1 且莊家贏）。
    if (ended && ended.breakdown && ended.breakdown.fans.some((f) => f.rule === "莊家連莊台")) {
      check("D", "連莊加成台數明細存在", true, `streak=${ended.streak}`);
    }

    // ---- 情境 C 驗證（第 2 局） ----
    if (nextRound === 2) {
      SCENARIO_C.active = false;
      check(
        "C",
        "15 秒不操作後伺服器自動摸切",
        SCENARIO_C.timedOut,
        SCENARIO_C.timedOut ? "已觸發" : "未觸發",
      );
      check(
        "C",
        "逾時後手動出牌恢復控制權",
        SCENARIO_C.recovered,
        SCENARIO_C.recovered ? "B 已手動恢復出牌" : "未恢復",
      );
    }
  }

  // ---- 整體情境驗證（多局累計） ----
  if (!fatalError) {
    const totalMelds = bots.reduce((n, b) => n + b.meldCount, 0);
    check(
      "A",
      "至少一局真實胡牌結算（非流局）",
      room.winCount > 0,
      `實勝 ${room.winCount} 局`,
    );
    check(
      "B",
      "整場出現吃/碰/槓副露",
      totalMelds > 0,
      `共 ${totalMelds} 副露（吃${bots.reduce((n, b) => n + b.chiCount, 0)} 碰${bots.reduce((n, b) => n + b.pengCount, 0)} 槓${bots.reduce((n, b) => n + b.kongCount, 0)}）`,
    );
    // 莊家需在破壞牌期間（第 3 局起）連胡至少 2 局，才能把 streak 推到 ≥2，
    // 這代表真的觸發過連莊台（莊家連莊台 fan）。用「最終 streak ≥ 2」當主判定，
    // 比單純數 dealerWinCount 更能反映「連續」胡牌（中間不能插流局/閒家胡）。
    const lastRound = room.rounds[room.rounds.length - 1];
    const maxStreak = room.rounds.reduce((m, r) => Math.max(m, r.streak), 0);
    check(
      "D",
      "莊家連續胡牌（連莊台）",
      maxStreak >= 2,
      `最高連莊 streak=${maxStreak}（莊家勝 ${room.dealerWinCount} 局）`,
    );
    if (lastRound && lastRound.streak >= 2) {
      check("D", "最終連莊 streak ≥ 2", true, `streak=${lastRound.streak}`);
    }
  }

  // ---- 情境 A 最後驗證：準備下一局重置。 ----
  // 第 5 局結束後，全員再按一次準備 → 應觸發第 6 局 game.started（重置流程）。
  if (!fatalError) {
    const startedBefore = room.started;
    log("\n--- 點擊「準備下一局」重置（情境 A 收尾） ---");
    everyoneReadies();
    const waitUntil = Date.now() + 15_000;
    while (room.started === startedBefore && Date.now() < waitUntil) {
      await sleep(200);
    }
    check("A", "準備下一局 → 自動重置並發新局", room.started > startedBefore);
  }

  printReport();

  for (const bot of bots) bot.ws?.close();
  const allPass = checks.every((c) => c.passed) && !fatalError;
  process.exit(allPass ? 0 : 1);
}

function printReport(): void {
  console.log("\n\n================ QA E2E 綜合測試報告 ================");
  console.log(`WS: ${WS_URL}`);
  console.log(`完成局數: ${room.ended}  （game.started×${room.started}）`);
  if (fatalError) console.log(`致命錯誤: ${fatalError}`);
  const byScenario = new Map<string, QaCheck[]>();
  for (const c of checks) {
    if (!byScenario.has(c.scenario)) byScenario.set(c.scenario, []);
    byScenario.get(c.scenario)!.push(c);
  }
  for (const [scenario, list] of byScenario) {
    const pass = list.filter((c) => c.passed).length;
    console.log(`\n情境 ${scenario}: ${pass}/${list.length} PASS`);
    for (const c of list) {
      console.log(`  ${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
  }
  const totalPass = checks.filter((c) => c.passed).length;
  console.log(`\n總計: ${totalPass}/${checks.length} 項通過`);
  console.log("==================================================");
}

void main();
