/**
 * Match Replay (牌譜覆盤引擎) — server-authoritative.
 *
 * Captures full deterministic step-by-step match events for post-game
 * replay, AI analysis, anti-cheat audit, and player review.
 */

import type { FanBreakdown, LedgerEntry } from "./types.js";
import type { ProvablyFairProof } from "./provably-fair.js";

export interface ReplayInitialDeal {
  dealer: number;
  dice: [number, number, number];
  hands: string[][];
  flowers: string[][];
  wallCount: number;
  serverSeedHash: string | null;
  clientSeed: string;
  nonce: number;
}

export type ReplayActionType =
  | "draw"
  | "discard"
  | "chi"
  | "peng"
  | "kong"
  | "win"
  | "draw_game"
  | "flower_replace";

export interface ReplayStep {
  step: number;
  type: ReplayActionType;
  seat: number;
  tileId?: string;
  targetSeat?: number;
  meldTiles?: string[];
  auto?: boolean;
  at: number;
}

export interface MatchReplay {
  id: string;
  roomId: string;
  variant: "north" | "south";
  handNonce: number;
  startedAt: string;
  endedAt: string;
  initial: ReplayInitialDeal;
  steps: ReplayStep[];
  winner: number | null;
  selfDraw: boolean;
  kongDraw: boolean;
  fanBreakdown: FanBreakdown | null;
  scores: number[];
  ledger: LedgerEntry[];
  provablyFairProof: ProvablyFairProof | null;
}
