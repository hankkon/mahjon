/**
 * Room — the authoritative room state machine.
 *
 * Lifecycle: lobby (waiting) → playing → ended (then cleanable).
 *  - 4 players ready ⇒ auto-deal (createGameState + createDeal).
 *  - Every discard triggers the auto-win check (合法可胡即自動胡牌) and, when no
 *    win, a reaction window (kong/peng/chi) offered to eligible seats.
 *  - Generation ID: monotonic per room; commands stamped with a stale
 *    generationId are dropped (防重機制).
 *  - operationId: idempotency key; the same operationId is never executed
 *    twice within the room's lifetime.
 */

import type {
  FanBreakdown,
  GameState,
  KongOption,
  LedgerEntry,
  Meld,
  RngFn,
  Seat,
  TileInstance,
  WinContext,
} from "@taiwan-mahjong/rules";
import {
  createGameState,
  declareWin,
  detectWin,
  drawTile,
  evaluateFans,
  nextSeat,
  performChi,
  performDiscard,
  performKong,
  performPeng,
  pengOptions,
  qiangKong,
  rngFromSeed,
  seatDistance,
  seedFromString,
  settleLedger,
  settleMultiLedger,
  type WinReaction,
} from "@taiwan-mahjong/rules";
import type { ClientCommand, ReactionCommand } from "./protocol.js";
import type { RoomLike, RoomPlayerLike } from "./snapshot.js";
import {
  collectPendingKinds,
  collectWinReactions,
  findChiOption,
  findKongOption,
} from "./gameLoop.js";

export type RoomStatus = "lobby" | "playing" | "ended";

export interface RoomPlayer extends RoomPlayerLike {
  playerId: string;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — true while the player is offline (server plays for them). */
  autoplay: boolean;
}

export interface RoomOptions {
  id: string;
  variant: "north" | "south";
  dealer?: Seat;
  rng?: RngFn;
  fanCap?: 4 | 8;
  pointPerFan?: number;
  /** Thinking-timeout for the discard/reaction phases (default 15s). */
  timeoutMs?: number;
  /**
   * Fired after a server-driven mutation (autoplay 摸切/pass, disconnect
   * force-autoplay) bumps the room generation. WSS subscribes to re-broadcast
   * snapshots to the room's clients — without this, bots would stall waiting
   * for a snapshot that never arrives. The Room itself never imports WSS.
   */
  onChange?: (room: Room) => void;
}

/** Outcome of executing a client command. */
export interface CommandResult {
  ok: boolean;
  error?: { code: string; message: string };
}

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const OTHERS = (seat: Seat): Seat[] => SEATS.filter((s) => s !== seat);

/** Order win reactions by turn distance from the discarder (nearest first),
 * so the primary `winner` mirrors the old nearest-winner behaviour. */
function sortedWinners(state: GameState, wins: readonly WinReaction[]): Seat[] {
  const from = state.lastDiscardBy ?? state.turn;
  return [...wins]
    .map((w) => w.seat as Seat)
    .sort((a, b) => seatDistance(from, a) - seatDistance(from, b));
}

export class Room implements RoomLike {
  readonly id: string;
  status: RoomStatus = "lobby";
  generationId = 0;
  players: (RoomPlayer | null)[] = [null, null, null, null];
  state: GameState | null = null;
  winner: number | null = null;
  selfDraw = false;
  kongDraw = false;
  breakdown: FanBreakdown | null = null;
  ledger: LedgerEntry[] | null = null;
  scores = [0, 0, 0, 0];

  /** Current operationId dedup ledger size (reset every round — no bloat). */
  get executedSize(): number {
    return this.executed.size;
  }

  private readonly variant: "north" | "south";
  /** Server-driven change notification (WSS re-broadcast). */
  private readonly onChange?: (room: Room) => void;
  /** Current dealer seat (rotates after every hand: 莊家輪替). */
  private dealer: Seat;
  /** Consecutive dealer holds (連莊); 0 = fresh dealer. Feeds 連莊台 scoring. */
  dealerStreak = 0;
  /** 自動託管 flag per seat — enabled on disconnect, disabled on reconnect. */
  autoplay: boolean[] = [false, false, false, false];
  /** Epoch ms when the current phase's autoplay timeout fires (null = none). */
  phaseDeadline: number | null = null;
  /** Autoplay audit log — server-driven 摸切/pass (observability + tests). */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }> = [];
  private readonly rng: RngFn;
  private readonly fanCap: 4 | 8;
  private readonly pointPerFan: number;
  /** Thinking timeout (15s default; configurable for tests / sims). */
  private readonly timeoutMs: number;
  private timeoutHandle: NodeJS.Timeout | null = null;
  /** operationId dedup — executed commands only. */
  private readonly executed = new Set<string>();
  /**
   * Seats that already passed in the CURRENT reaction window. A pass only
   * removes that seat's pending kinds — the window closes only after EVERY
   * pending seat passes (or a claim resolves it). Prevents a single unrelated
   * pass (e.g. an AI with no claim rights) from killing the human's window.
   */
  private pendingPasses = new Set<number>();

  constructor(options: RoomOptions) {
    this.id = options.id;
    this.variant = options.variant;
    this.dealer = options.dealer ?? 0;
    this.rng = options.rng ?? rngFromSeed(seedFromString(options.id));
    this.fanCap = options.fanCap ?? 4;
    this.pointPerFan = options.pointPerFan ?? 100;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.dealerStreak = 0;
    this.onChange = options.onChange;
  }

  // -------------------------------------------------------------------------
  // Players
  // -------------------------------------------------------------------------

  join(playerId: string, playerName = "Player"): Seat {
    const existing = this.players.findIndex((p) => p?.playerId === playerId);
    if (existing !== -1) return existing as Seat;
    if (this.status !== "lobby") {
      throw new Error("Room is not accepting players");
    }
    const seat = this.players.findIndex((p) => p === null);
    if (seat === -1) throw new Error("Room is full");
    this.players[seat] = { playerId, playerName, connected: true, ready: false, autoplay: false };
    this.bump();
    return seat as Seat;
  }

  seatOf(playerId: string): number {
    return this.players.findIndex((p) => p?.playerId === playerId);
  }

  setConnected(playerId: string, connected: boolean): void {
    const idx = this.players.findIndex((x) => x?.playerId === playerId);
    const p = idx === -1 ? undefined : this.players[idx];
    if (p) {
      p.connected = connected;
      const seat = idx as Seat;
      if (this.status === "playing") {
        if (connected) {
          // Reconnect → restore manual control + a fresh thinking timer.
          this.autoplay[seat] = false;
          this.scheduleAutoplay();
        } else {
          // Disconnect → enable 自動託管 and immediately resolve any action
          // this seat is currently blocking (摸切 / pass).
          this.autoplay[seat] = true;
          this.forceAutoplay(seat);
        }
        // Keep the RoomPlayer flag in sync — snapshots & tests read it directly.
        p.autoplay = this.autoplay[seat];
      }
      this.bump();
    }
  }

  setReady(playerId: string): void {
    const seat = this.seatOf(playerId);
    if (seat === -1) throw new Error("Player not in room");
    // A round is over — the first ready resets the room for the next round.
    if (this.status === "ended") this.resetForNextRound();
    const p = this.players[seat]!;
    p.ready = true;
    this.bump();
    if (this.status === "lobby" && this.players.every((x) => x?.ready === true)) {
      this.startGame();
    }
  }

  /**
   * Reset the room for the next round while keeping the seats and the running
   * scores. Transitions ended → lobby; every player must ready again before the
   * next deal. Returns false when the room is not in the ended state.
   */
  resetForNextRound(): boolean {
    if (this.status !== "ended") return false;
    this.clearAutoplay();
    // Per-round autoplay audit log — a fresh hand starts with an empty log.
    this.autoplayLog = [];
    // A fresh hand returns every seat to manual control (自動託管 off).
    this.autoplay = [false, false, false, false];
    this.status = "lobby";
    for (const p of this.players) {
      if (p) {
        p.ready = false;
        p.autoplay = false;
      }
    }
    this.state = null;
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = null;
    this.bump();
    return true;
  }

  private startGame(): void {
    if (this.status !== "lobby") return;
    const allConnected = this.players.every((p) => p && p.connected);
    if (!allConnected) return;
    // A fresh deal consumes everyone's ready — the next hand requires each
    // player to ready again (resetForNextRound expects that, and the AI
    // controller / human clients re-ready via their tick loops).
    for (const p of this.players) {
      if (p) p.ready = false;
    }
    this.state = createGameState(this.variant, this.rng, this.dealer, this.dealerStreak);
    // 莊家起手第 17 張視為本手「首張摸牌」：createGameState 的初始發牌不會設定
    // lastDrawnBy/lastDrawnTile，若不補上，客戶端在莊家首手（17 張）會無法以伺服器
    // 權威資料分離第 17 張（舊版 max-instanceId 啟發式會分錯張）。
    const dealerHand = this.state!.wall.hands[this.dealer]!;
    this.state.lastDrawnBy = this.dealer;
    this.state.lastDrawnTile = dealerHand[dealerHand.length - 1];
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = null;
    this.scores = [0, 0, 0, 0];
    // A fresh round also resets the operationId idempotency ledger — otherwise
    // every round would re-accumulate executed operationIds forever.
    this.executed.clear();
    this.status = "playing";
    this.bump();
    this.scheduleAutoplay();
  }

  // -------------------------------------------------------------------------
  // Command handling — Generation ID + operationId dedup
  // -------------------------------------------------------------------------

  handleCommand(playerId: string, command: ClientCommand): CommandResult {
    const seat = this.seatOf(playerId);
    if (seat === -1) {
      return { ok: false, error: { code: "not_in_room", message: "Player not in this room" } };
    }
    // --- Stale generation check (防重) ---
    const gen = command.generationId;
    if (gen !== undefined && gen < this.generationId) {
      return { ok: false, error: { code: "stale_generation", message: "Command is stale" } };
    }
    // --- Idempotency (same operationId never executed twice) ---
    if (this.executed.has(command.operationId)) {
      return { ok: true };
    }

    let result: CommandResult;
    switch (command.type) {
      case "ready":
        result = this.doReady(seat as Seat);
        break;
      case "discard":
        result = this.doDiscard(seat as Seat, command.tileInstanceId);
        break;
      case "reaction":
        result = this.doReaction(seat as Seat, command);
        break;
      case "pass":
        result = this.doPass(seat as Seat);
        break;
      default:
        result = { ok: false, error: { code: "not_allowed", message: "Command not allowed" } };
    }

    if (result.ok) {
      this.executed.add(command.operationId);
      this.bump();
    }
    // Any accepted command may have moved the game into a new phase — resync
    // the thinking timeout (discard 摸切 / reaction auto-pass).
    this.scheduleAutoplay();
    return result;
  }

  private doReady(seat: Seat): CommandResult {
    // A round is over — the first ready resets the room for the next round.
    if (this.status === "ended") this.resetForNextRound();
    if (this.status !== "lobby") {
      return { ok: false, error: { code: "not_lobby", message: "Game already started" } };
    }
    const p = this.players[seat];
    if (!p) return { ok: false, error: { code: "no_player", message: "No player at seat" } };
    if (!p.connected) {
      return { ok: false, error: { code: "disconnected", message: "Seat is disconnected" } };
    }
    p.ready = true;
    if (this.players.every((x) => x?.ready === true)) this.startGame();
    return { ok: true };
  }

  private doDiscard(seat: Seat, tileInstanceId: number): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;
    if (state.turn !== seat) {
      return { ok: false, error: { code: "not_your_turn", message: "Not your turn" } };
    }
    if (state.phase !== "discard") {
      return { ok: false, error: { code: "wrong_phase", message: "Cannot discard now" } };
    }
    const hand = state.wall.hands[seat]!;
    if (!hand.some((t) => t.instanceId === tileInstanceId)) {
      return { ok: false, error: { code: "no_tile", message: "Tile not in hand" } };
    }
    performDiscard(state, seat, tileInstanceId);
    this.afterDiscard();
    return { ok: true };
  }

  /** Server-side auto-win + reaction window evaluation after a discard. */
  private afterDiscard(): void {
    const state = this.state;
    if (!state) return;
    // 1. Auto-win check: 合法可胡即自動胡牌 — no win button, server declares it.
    const wins = collectWinReactions(state);
    if (wins.length > 0) {
      // 一砲多響 (P0-4): EVERY eligible seat wins on the discard — never
      // collapse the field to a single nearest winner. finishWin settles the
      // discarder against each winner separately.
      this.finishWin(state, sortedWinners(state, wins), false, false);
      return;
    }
    // 2. No win: reaction window for kong/peng/chi — phase stays "reaction".
    //    Fresh window → clear the per-window pass bookkeeping.
    this.pendingPasses.clear();
    const pending = collectPendingKinds(state);
    if (pending.size === 0) {
      // 3. Nobody can react: pass the turn (next seat draws).
      this.passTurnAfterUnclaimed();
    }
  }

  private doReaction(seat: Seat, command: ReactionCommand): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;

    // --- Self kong (closed / add-on) during the player's own discard phase. ---
    if (command.kind === "kong" && state.phase === "discard" && state.turn === seat) {
      const option = findKongOption(
        state,
        seat,
        false,
        command.kongType ?? "",
        command.handTileIds,
        command.pengMeldId,
      );
      if (!option) {
        return { ok: false, error: { code: "illegal_kong", message: "Not a legal kong" } };
      }
      if (option.kongType === "add-on") {
        // 搶槓 (P0-1): pass the add-on tile explicitly — NEVER read it from
        // state.lastDiscard (undefined until performKong runs). The kongger's
        // seat becomes discardWinSeat so the ledger debits the right player.
        const extra = this.addOnTile(state, seat, option);
        if (!extra) {
          return { ok: false, error: { code: "illegal_kong", message: "Add-on tile not in hand" } };
        }
        const robber = this.qiangKongCheck(state, OTHERS(seat), extra);
        if (robber !== null) {
          this.finishWin(state, robber, false, false, seat);
          return { ok: true };
        }
      }
      performKong(state, seat, option);
      this.trackKongDraw(state, seat);
      // 槓上開花 (P0-2): the replacement draw may complete the kongger's hand.
      if (this.resolveKongDrawWin(state, seat)) return { ok: true };
      return { ok: true };
    }

    // --- Otherwise a reaction window against the latest discard is required. ---
    const discardBy = state.lastDiscardBy;
    if (discardBy === undefined || !state.lastDiscard) {
      return { ok: false, error: { code: "no_discard", message: "No discard to react to" } };
    }
    if (state.phase !== "reaction") {
      return { ok: false, error: { code: "wrong_phase", message: "No reaction window open" } };
    }
    if (seat === discardBy) {
      return { ok: false, error: { code: "self_reaction", message: "Cannot react to own discard" } };
    }

    switch (command.kind) {
      case "chi": {
        const ids = command.handTileIds;
        if (!ids || ids.length !== 2) {
          return { ok: false, error: { code: "bad_chi", message: "Chi requires 2 hand tiles" } };
        }
        const option = findChiOption(state, seat, [ids[0]!, ids[1]!]);
        if (!option) {
          return { ok: false, error: { code: "illegal_chi", message: "Not a legal chi" } };
        }
        if (this.autoWinOverride()) return { ok: true };
        performChi(state, seat, option);
        return { ok: true };
      }
      case "peng": {
        if (pengOptions(state, seat) === null) {
          return { ok: false, error: { code: "illegal_peng", message: "Not a legal peng" } };
        }
        if (this.autoWinOverride()) return { ok: true };
        const option = pengOptions(state, seat)!;
        performPeng(state, seat, option);
        return { ok: true };
      }
      case "kong": {
        const option = findKongOption(
          state,
          seat,
          true,
          command.kongType ?? "",
          command.handTileIds,
          command.pengMeldId,
        );
        if (!option) {
          return { ok: false, error: { code: "illegal_kong", message: "Not a legal kong" } };
        }
        if (option.kongType === "add-on") {
          // 搶槓 (P0-1): other players may win on the added tile.
          const extra = this.addOnTile(state, seat, option);
          if (!extra) {
            return { ok: false, error: { code: "illegal_kong", message: "Add-on tile not in hand" } };
          }
          const robber = this.qiangKongCheck(state, OTHERS(seat), extra);
          if (robber !== null) {
            this.finishWin(state, robber, false, false, seat);
            return { ok: true };
          }
        }
        performKong(state, seat, option);
        this.trackKongDraw(state, seat);
        // 槓上開花 (P0-2): the replacement draw may complete the kongger's hand.
        if (this.resolveKongDrawWin(state, seat)) return { ok: true };
        return { ok: true };
      }
      default:
        return { ok: false, error: { code: "unknown_kind", message: "Unknown reaction" } };
    }
  }

  /** Auto-win trumps any non-win reaction. Returns true when a win fired. */
  private autoWinOverride(): boolean {
    const state = this.state;
    if (!state) return false;
    const wins = collectWinReactions(state);
    if (wins.length === 0) return false;
    // 一砲多響 (P0-4): every eligible winner settles.
    this.finishWin(state, sortedWinners(state, wins), false, false);
    return true;
  }

  private doPass(seat: Seat): CommandResult {
    if (this.status !== "playing" || !this.state) {
      return { ok: false, error: { code: "not_playing", message: "Game is not in progress" } };
    }
    const state = this.state;
    if (state.phase !== "reaction") {
      return { ok: false, error: { code: "wrong_phase", message: "No reaction window open" } };
    }
    // Pass semantics:
    //  - An eligible (pending) seat's pass only removes ITS right; the window
    //    stays open until EVERY pending seat has passed (prevents one AI pass
    //    from killing the human's window).
    //  - A pass from a NON-pending seat (the discarder, or scripts/tests that
    //    force-close the window) still closes it — preserves the legacy flow.
    const pending = collectPendingKinds(state);
    if (pending.has(seat)) {
      this.pendingPasses.add(seat);
      const allPendingPassed = [...pending.keys()].every((s) => this.pendingPasses.has(s));
      if (!allPendingPassed) return { ok: true };
    } else if (seat !== state.lastDiscardBy && pending.size > 0) {
      // Ignore pass from non-discarder, non-eligible seats so AI tick races don't kill the window.
      return { ok: true };
    }
    this.pendingPasses.clear();
    this.passTurnAfterUnclaimed();
    return { ok: true };
  }



  /**
   * Kong replacement draws (尾牆補牌) are also 摸切 targets — record the last
   * physical tile added to the kongger's hand so a discard timeout discards it.
   */
  private trackKongDraw(state: GameState, seat: Seat): void {
    state.lastDrawnBy = seat;
    const hand = state.wall.hands[seat]!;
    state.lastDrawnTile = hand[hand.length - 1]!;
  }

  /** Advance to the next seat's draw when a discard goes unclaimed. */
  private passTurnAfterUnclaimed(): void {
    this.pendingPasses.clear();
    const state = this.state;
    if (!state) return;
    const next = ((state.turn + 1) % 4) as Seat;
    state.turn = next;
    state.phase = "draw";
    try {
      drawTile(state.wall, next);
      // 摸切 target: the most recently added physical tile (post flower chain).
      state.lastDrawnBy = next;
      const drawnHand = state.wall.hands[next]!;
      state.lastDrawnTile = drawnHand[drawnHand.length - 1]!;
      // Self-draw auto-win check (only the drawer can win — single winner).
      const wins = this.collectSelfWinReactions(state, next);
      if (wins.length > 0) {
        this.finishWin(state, next, true, false);
        return;
      }
      state.phase = "discard";
    } catch {
      // Wall exhausted (流局) — end the hand with no winner.
      state.phase = "ended";
      this.finishDraw();
    }
  }

  /** Auto-win on a self draw (no discard involved). */
  private collectSelfWinReactions(state: GameState, seat: Seat): WinReaction[] {
    const hand = state.wall.hands[seat]!;
    const melds = state.melds[seat] as Meld[];
    if (detectWin(hand, melds).win) {
      return [{ kind: "win", seat, selfDraw: true }];
    }
    return [];
  }

  /** The physical tile being added in an add-on kong (from the kong option). */
  private addOnTile(state: GameState, seat: Seat, option: KongOption): TileInstance | null {
    const id = option.handTileIds[0];
    if (id === undefined) return null;
    return state.wall.hands[seat]?.find((t) => t.instanceId === id) ?? null;
  }

  /**
   * 槓上開花 (P0-2) — after a kong replacement draw (尾牆補牌) the kongger's own
   * hand may now be complete. Runs the self-draw win check and settles the hand
   * with `kongDraw=true` so the 槓上開花 win is recorded in scoring/settlement.
   * Returns true when the win fired (game is now ended).
   */
  private resolveKongDrawWin(state: GameState, seat: Seat): boolean {
    const wins = this.collectSelfWinReactions(state, seat);
    if (wins.length === 0) return false;
    this.finishWin(state, seat, true, true);
    return true;
  }

  /** 搶槓 (qiang kong): a robber wins on the add-on tile. */
  private qiangKongCheck(
    state: GameState,
    robbers: readonly Seat[],
    extra: TileInstance,
  ): Seat | null {
    return qiangKong(
      state,
      robbers,
      extra,
      (seat) => state.wall.hands[seat] as readonly TileInstance[],
      // P0-1: the win callback receives the ACTUAL robber seat and reads that
      // seat's own melds — the previous code hard-coded robbers[0], so any
      // robber with open melds was checked against the wrong player's melds.
      (seat, hand, robbed) => {
        const melds = state.melds[seat] as Meld[];
        return detectWin([...hand, robbed], melds).win;
      },
    ) as Seat | null;
  }

  // -------------------------------------------------------------------------
  // Settlement
  // -------------------------------------------------------------------------

  /**
   * Settle a win — single winner, or 一砲多響 (P0-4) with multiple winners on
   * the same discard. `discardWinSeat` is required for 搶槓 (the kongger pays);
   * for a normal discard win it falls back to state.lastDiscardBy.
   */
  private finishWin(
    state: GameState,
    winner: Seat | readonly Seat[],
    selfDraw: boolean,
    kongDraw: boolean,
    discardWinSeat?: Seat,
  ): void {
    const winners = (Array.isArray(winner) ? winner : [winner]) as Seat[];
    const primary = winners[0]!;
    // 莊家輪替 / 連莊: if the dealer is among the winners → 連莊 (streak+1);
    // otherwise 過莊 (dealer passes to the next seat, streak resets to 0).
    if (winners.includes(this.dealer)) {
      this.dealerStreak += 1;
    } else {
      this.dealer = nextSeat(this.dealer);
      this.dealerStreak = 0;
    }
    // Scoring reads state.dealerStreak for the 連莊台 fan — expose the
    // updated streak so this hand's ledger reflects it.
    state.dealerStreak = this.dealerStreak;
    declareWin(state, primary, selfDraw);
    this.winner = primary;
    this.selfDraw = selfDraw;
    this.kongDraw = kongDraw;

    // Per-winner scoring context. For discard wins the payer is the provided
    // discardWinSeat (搶槓 kongger) or the room's last discarder.
    const ctxs: WinContext[] = winners.map((w) => ({
      winner: w,
      selfDraw,
      kongDraw,
      discardWin: !selfDraw,
      discardWinSeat: !selfDraw ? (discardWinSeat ?? state.lastDiscardBy) : undefined,
      dealerStreak: state.dealerStreak,
      dealer: state.dealer,
      hand: state.wall.hands[w] as readonly TileInstance[],
      melds: state.melds[w] as Meld[],
    }));
    this.breakdown = evaluateFans(ctxs[0]!, this.fanCap);
    this.ledger =
      ctxs.length === 1
        ? settleLedger(ctxs[0]!, this.fanCap, this.pointPerFan)
        : settleMultiLedger(ctxs, this.fanCap, this.pointPerFan);
    for (const entry of this.ledger) {
      this.scores[entry.seat] = (this.scores[entry.seat] ?? 0) + entry.delta;
    }
    this.status = "ended";
    this.state = state;
    this.clearAutoplay();
  }

  /** 流局 (exhausted wall) — no winner, scores unchanged. */
  private finishDraw(): void {
    this.winner = null;
    this.selfDraw = false;
    this.kongDraw = false;
    this.breakdown = null;
    this.ledger = [
      { seat: 0, delta: 0 },
      { seat: 1, delta: 0 },
      { seat: 2, delta: 0 },
      { seat: 3, delta: 0 },
    ];
    // 流局: 莊家連莊 — the dealer keeps the seat and the streak advances.
    this.dealerStreak += 1;
    this.status = "ended";
    this.clearAutoplay();
  }

  // -------------------------------------------------------------------------
  // Misc
  // -------------------------------------------------------------------------

  /** Expose the pending non-win reaction window (for tests / hints). */
  pendingKinds(): Map<number, Set<string>> {
    if (!this.state) return new Map();
    const m = new Map<number, Set<string>>();
    for (const [seat, kinds] of collectPendingKinds(this.state)) {
      m.set(seat, new Set([...kinds]));
    }
    return m;
  }

  // -------------------------------------------------------------------------
  // Timeout Autoplay (斷線逾時自動託管)
  // -------------------------------------------------------------------------

  private clearAutoplay(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.phaseDeadline = null;
  }

  /**
   * Schedule the thinking timer for the current phase:
   *  - discard phase → timeout auto-摸切 (discard the latest drawn tile).
   *  - reaction phase → timeout auto-pass (never blocks the table).
   * Disconnected seats act immediately (delay 0) so a table never stalls.
   */
  private scheduleAutoplay(): void {
    this.clearAutoplay();
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    let delay: number | null = null;
    if (state.phase === "discard") {
      const turnSeat = state.turn as Seat;
      delay = this.autoplay[turnSeat] ? 0 : this.timeoutMs;
    } else if (state.phase === "reaction") {
      const pending = collectPendingKinds(state);
      if (pending.size === 0) return; // no window — no timer needed
      const allPendingOffline = [...pending.keys()].every(
        (s) => !this.players[s]?.connected,
      );
      delay = allPendingOffline ? 0 : this.timeoutMs;
    }
    if (delay === null) return;
    this.phaseDeadline = Date.now() + delay;
    this.timeoutHandle = setTimeout(() => {
      if (state.phase === "discard") this.onDiscardTimeout();
      else if (state.phase === "reaction") this.onReactionTimeout();
    }, delay);
    this.timeoutHandle.unref?.();
  }

  /** 出牌逾時 → 摸切: the server discards the most recently drawn tile. */
  private onDiscardTimeout(): void {
    this.timeoutHandle = null;
    this.phaseDeadline = null;
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    if (state.phase !== "discard") return;
    const seat = state.turn as Seat;
    const hand = state.wall.hands[seat]!;
    if (hand.length === 0) return;
    // 摸切 target: the tile drawn this turn (still in hand). Fall back to the
    // last hand tile when no draw is recorded (e.g. a chi/peng claimant).
    let target =
      state.lastDrawnBy === seat && state.lastDrawnTile
        ? (hand.find((t) => t.instanceId === state.lastDrawnTile!.instanceId) ?? null)
        : null;
    if (!target) target = hand[hand.length - 1]!;
    performDiscard(state, seat, target.instanceId);
    this.autoplayLog.push({
      seat,
      action: "discard",
      reason: this.autoplay[seat] ? "disconnect" : "timeout",
      at: Date.now(),
    });
    this.afterDiscard();
    this.bump();
    this.scheduleAutoplay();
    // Timer-driven mutation — push the new state to the clients immediately.
    this.onChange?.(this);
  }

  /** Reaction 逾時 → 自動 pass, keeping the table moving. */
  private onReactionTimeout(): void {
    this.timeoutHandle = null;
    this.phaseDeadline = null;
    if (this.status !== "playing" || !this.state) return;
    const state = this.state;
    if (state.phase !== "reaction") return;
    this.pendingPasses.clear();
    this.autoplayLog.push({
      seat: state.turn as Seat,
      action: "pass",
      reason: "timeout",
      at: Date.now(),
    });
    this.passTurnAfterUnclaimed();
    this.bump();
    this.scheduleAutoplay();
    // Timer-driven mutation — push the new state to the clients immediately.
    this.onChange?.(this);
  }

  /** When a seat disconnects, resolve its pending action immediately. */
  private forceAutoplay(seat: Seat): void {
    const state = this.state;
    if (!state || this.status !== "playing") return;
    if (state.phase === "discard") {
      if (state.turn === seat) this.onDiscardTimeout();
      return;
    }
    if (state.phase === "reaction") {
      const pending = collectPendingKinds(state);
      if (pending.has(seat)) {
        this.doPass(seat);
      } else {
        const allPendingOffline = [...pending.keys()].every(
          (s) => !this.players[s]?.connected,
        );
        if (pending.size > 0 && allPendingOffline) this.onReactionTimeout();
      }
    }
  }

  /** Release timers (RoomManager cleanup / shutdown). */
  dispose(): void {
    this.clearAutoplay();
  }

  private bump(): void {
    this.generationId += 1;
  }
}
