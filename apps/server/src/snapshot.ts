/**
 * Client-Safe Snapshot — per-viewer projection of the authoritative state.
 *
 * Only observable state leaves the server:
 *  - your own hand (full instance ids) — others are masked to a count.
 *  - melds / discards / flowers (public table state).
 *  - wall details are reduced to remaining counts (no tile internals).
 *  - current turn, phase, dealer, and the reaction hint for the viewer.
 */

import type {
  FanBreakdown,
  GamePhase,
  GameState,
  Honor,
  LedgerEntry,
  Meld,
  Numbered,
  Suit,
  TileInstance,
} from "@taiwan-mahjong/rules";
import {
  chiOptions,
  deckRemaining,
  detectWin,
  headRemaining,
  kongOptions,
  pengOptions,
  tileToId,
} from "@taiwan-mahjong/rules";

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface TileWire {
  instanceId: number;
  id: string;
}

export interface WireMeld {
  id: number;
  kind: "chi" | "peng" | "kong";
  kongType?: "open" | "closed" | "add-on";
  tiles: string[];
  claimed?: string;
}

export interface WireChiOption {
  handTileIds: [number, number];
  run: string[];
}

export interface WireKongOption {
  kongType: "open" | "closed" | "add-on";
  handTileIds: number[];
  pengMeldId?: number;
}

export interface ReactionHint {
  canChi: boolean;
  canPeng: boolean;
  canKong: boolean;
  chiOptions: WireChiOption[];
  kongOptions: WireKongOption[];
}

export interface PlayerView {
  seat: number;
  playerId: string | null;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — the server is playing for this seat (offline). */
  autoplay: boolean;
  handCount: number;
  /** Full hand — only for the viewer (masked for everyone else). */
  hand: TileWire[] | null;
  flowers: string[];
  melds: WireMeld[];
}

export interface SettlementView {
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  breakdown: FanBreakdown | null;
  ledger: LedgerEntry[];
  scores: number[];
}

export interface ClientSnapshot {
  roomId: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  you: number;
  dealer: number | null;
  /** 連莊數 (0 = fresh dealer, >=1 = consecutive holds). */
  dealerStreak: number;
  turn: number | null;
  gamePhase: GamePhase | null;
  players: PlayerView[];
  discards: string[];
  /** Per-seat discard rivers (各家棄牌河) — [[seat0 tiles], [seat1 tiles], ...]. */
  discardsBySeat: string[][];
  lastDiscard: string | null;
  lastDiscardBy: number | null;
  /** The seat that most recently drew a tile (public — observable from turn flow). */
  lastDrawnBy: number | null;
  /** The most recently drawn tile — only revealed to the drawer itself (own hand). */
  lastDrawnTile: TileWire | null;
  wall: { headRemaining: number; deckRemaining: number };
  reactionHint: ReactionHint | null;
  /** 可胡狀態（聽牌）— the viewer is one tile away from a win; feeds 胡牌光暈. */
  canWin: boolean;
  /** Epoch-ms deadline for the current phase's autoplay timeout (null = none). */
  phaseDeadline: number | null;
  /** ms until the phase deadline fires (client countdown; null = none). */
  countdownMs: number | null;
  /** Server-driven autoplay actions (摸切/pass) this hand — observability. */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }>;
  winner: number | null;
  settlement: SettlementView | null;
}

/** Structural contract Room satisfies so snapshot.ts never imports room.ts. */
export interface RoomLike {
  id: string;
  status: "lobby" | "playing" | "ended";
  generationId: number;
  players: (RoomPlayerLike | null)[];
  state: GameState | null;
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  breakdown: FanBreakdown | null;
  ledger: LedgerEntry[] | null;
  scores: number[];
  /** Consecutive dealer holds (連莊) — feeds 連莊台 + rotation verification. */
  dealerStreak: number;
  /** Epoch-ms deadline of the current autoplay timeout (null = none). */
  phaseDeadline: number | null;
  /** 自動託管 flag per seat. */
  autoplay: boolean[];
  /** Autoplay audit log — server-driven 摸切/pass. */
  autoplayLog: Array<{
    seat: number;
    action: "discard" | "pass";
    reason: "timeout" | "disconnect";
    at: number;
  }>;
}

export interface RoomPlayerLike {
  playerId: string;
  playerName: string;
  connected: boolean;
  ready: boolean;
  /** 自動託管 — true while the server plays for this seat. */
  autoplay: boolean;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function wireMeld(m: Meld): WireMeld {
  return {
    id: m.id,
    kind: m.kind,
    kongType: m.kind === "kong" ? m.kongType : undefined,
    tiles: m.tiles.map((t) => tileToId(t.tile)),
    claimed: m.claimed ? tileToId(m.claimed.tile) : undefined,
  };
}

/** All 34 tile identities (27 numbered + 7 honors) — the tenpai wait space. */
const ALL_TILE_IDS: string[] = (() => {
  const ids: string[] = [];
  for (const suit of ["wan", "tiao", "tong"] as const) {
    for (let rank = 1; rank <= 9; rank++) ids.push(`${suit}:${rank}`);
  }
  for (const honor of ["dong", "nan", "xi", "bei", "zhong", "fa", "bai"] as const) {
    ids.push(`honor:${honor}`);
  }
  return ids;
})();

function fakeTile(id: string): TileInstance {
  const [category, value] = id.split(":");
  if (category === "honor") {
    return { tile: { kind: "honor", honor: value as Honor }, instanceId: -1 };
  }
  return {
    tile: { kind: "numbered", suit: category as Suit, rank: Number(value) as Numbered["rank"] },
    instanceId: -1,
  };
}

/**
 * Tenpai (聽牌) check — the viewer is one tile away from a win: there exists a
 * tile X in hand and an identity T such that (hand − X + T) forms a winning
 * hand. Feeds the client's 胡牌光暈 (win glow) on win-possible snapshots.
 */
function isTenpai(state: GameState, seat: number): boolean {
  const hand = state.wall.hands[seat];
  const melds = state.melds[seat] as Meld[];
  if (!hand || hand.length < 14) return false;
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, idx) => idx !== i);
    for (const id of ALL_TILE_IDS) {
      if (detectWin([...rest, fakeTile(id)], melds).win) return true;
    }
  }
  return false;
}

function computeHint(state: GameState, seat: number): ReactionHint | null {
  const hint: ReactionHint = {
    canChi: false,
    canPeng: false,
    canKong: false,
    chiOptions: [],
    kongOptions: [],
  };
  const discard = state.lastDiscard;

  if (
    state.phase === "reaction" &&
    discard &&
    state.lastDiscardBy !== undefined &&
    state.lastDiscardBy !== seat
  ) {
    // Claim window: open kong / peng / chi against the latest discard.
    const kongs = kongOptions(state, seat, true);
    if (kongs.length > 0) {
      hint.canKong = true;
      hint.kongOptions = kongs.map((k) => ({
        kongType: k.kongType,
        handTileIds: [...k.handTileIds],
        pengMeldId: k.pengMeldId,
      }));
    }
    if (pengOptions(state, seat) !== null) hint.canPeng = true;
    const chis = chiOptions(state, seat, discard);
    if (chis !== null && chis.length > 0) {
      hint.canChi = true;
      hint.chiOptions = chis.map((o) => ({
        handTileIds: [o.handTiles[0]!.instanceId, o.handTiles[1]!.instanceId],
        run: o.run.map((t) => tileToId(t.tile)),
      }));
    }
  } else if (state.phase === "discard" && state.turn === seat) {
    // Self kong (closed / add-on) may be declared before discarding.
    const kongs = kongOptions(state, seat, false);
    if (kongs.length > 0) {
      hint.canKong = true;
      hint.kongOptions = kongs.map((k) => ({
        kongType: k.kongType,
        handTileIds: [...k.handTileIds],
        pengMeldId: k.pengMeldId,
      }));
    }
  }

  return hint.canChi || hint.canPeng || hint.canKong ? hint : null;
}

/** Build the Client-Safe snapshot as seen from `seat`. */
export function buildClientSnapshot(room: RoomLike, seat: number): ClientSnapshot {
  const state = room.state;

  // Pre-map public per-player wire formats (flowers, melds) to avoid redundant allocations
  const playerPublicWires = room.players.map((p, i) => {
    const flowers = state && p ? state.wall.flowers[i] : undefined;
    return {
      flowers: flowers ? flowers.map((t) => tileToId(t.tile)) : [],
      melds: state && p ? (state.melds[i] as Meld[]).map(wireMeld) : [],
    };
  });

  const players: PlayerView[] = room.players.map((p, i) => {
    const isYou = i === seat;
    const pub = playerPublicWires[i]!;
    const hand = state && p ? state.wall.hands[i] : undefined;
    return {
      seat: i,
      playerId: p ? p.playerId : null,
      playerName: p ? p.playerName : "",
      connected: p ? p.connected : false,
      ready: p ? p.ready : false,
      autoplay: p ? p.autoplay : false,
      handCount: hand ? hand.length : 0,
      hand:
        isYou && hand
          ? hand.map((t) => ({ instanceId: t.instanceId, id: tileToId(t.tile) }))
          : null,
      flowers: pub.flowers,
      melds: pub.melds,
    };
  });

  return {
    roomId: room.id,
    status: room.status,
    generationId: room.generationId,
    you: seat,
    dealer: state ? state.dealer : null,
    dealerStreak: room.dealerStreak,
    turn: state ? state.turn : null,
    gamePhase: state ? state.phase : null,
    players,
    discards: state ? state.discards.map((t) => tileToId(t.tile)) : [],
    discardsBySeat: state
      ? state.discardsBySeat.map((river) => river.map((t) => tileToId(t.tile)))
      : [[], [], [], []],
    lastDiscard: state?.lastDiscard ? tileToId(state.lastDiscard.tile) : null,
    lastDiscardBy: state?.lastDiscardBy ?? null,
    lastDrawnBy: state?.lastDrawnBy ?? null,
    lastDrawnTile:
      state?.lastDrawnBy === seat && state.lastDrawnTile
        ? { instanceId: state.lastDrawnTile.instanceId, id: tileToId(state.lastDrawnTile.tile) }
        : null,
    wall: state
      ? { headRemaining: headRemaining(state.wall), deckRemaining: deckRemaining(state.wall) }
      : { headRemaining: 0, deckRemaining: 0 },
    reactionHint: state ? computeHint(state, seat) : null,
    canWin: state ? isTenpai(state, seat) : false,
    phaseDeadline: room.phaseDeadline,
    countdownMs:
      room.phaseDeadline === null ? null : Math.max(0, room.phaseDeadline - Date.now()),
    autoplayLog: room.autoplayLog,
    winner: room.winner,
    settlement:
      room.status === "ended" && room.ledger
        ? {
            winner: room.winner,
            selfDraw: room.selfDraw,
            kongDraw: room.kongDraw,
            breakdown: room.breakdown,
            ledger: room.ledger,
            scores: room.scores,
          }
        : null,
  };
}
