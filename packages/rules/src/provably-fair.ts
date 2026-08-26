/**
 * provably-fair.ts — Stake-compliant Provably Fair cryptographic verification system.
 *
 * Implements the industry-standard Provably Fair mechanism:
 * 1. Server Seed (伺服器種子): Generated as 256-bit CSPRNG hex string.
 * 2. Server Seed Hash (承諾哈希): SHA-256(serverSeed). Committed to all clients BEFORE the hand.
 * 3. Client Seed (客戶端種子): Provided by players / room to ensure the server cannot precompute hands.
 * 4. Nonce (局號): Increments monotonically per hand (1, 2, 3...).
 * 5. Deterministic Derivation: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`) -> 32-bit PRNG seed.
 * 6. Post-Game Reveal & Audit: Server reveals plaintext serverSeed upon game end.
 *    Any player can verify SHA-256(serverSeed) === serverSeedHash and replay the exact wall/dice.
 *
 * Authoritative Domain — `packages/rules`.
 */

import { createHash, createHmac, randomBytes } from "node:crypto";
import { SeededRng, type RngFn } from "./rng.js";

/** Pre-game commitment visible to all players while the game is active. */
export interface ProvablyFairCommitment {
  /** SHA-256 hash of the secret server seed. */
  serverSeedHash: string;
  /** Active client seed for this round. */
  clientSeed: string;
  /** Round nonce (1, 2, 3...). */
  nonce: number;
}

/** Post-game proof revealed at settlement for independent verification. */
export interface ProvablyFairProof {
  /** The revealed plaintext server seed (64-char hex). */
  serverSeed: string;
  /** The original pre-game commitment hash. */
  serverSeedHash: string;
  /** The client seed used. */
  clientSeed: string;
  /** The round nonce. */
  nonce: number;
  /** The derived 32-bit integer seed used to drive the PRNG. */
  derivedSeed: number;
}

/** Verification result from audit check. */
export interface ProvablyFairVerification {
  valid: boolean;
  calculatedHash: string;
  calculatedSeed: number;
  hashMatches: boolean;
  seedMatches: boolean;
}

/** Generate a cryptographically secure 256-bit server seed (64-character hex). */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** Generate a default client seed (32-character hex). */
export function generateClientSeed(): string {
  return randomBytes(16).toString("hex");
}

/** Compute the SHA-256 hash of a server seed (commitment). */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

/**
 * Derive a 32-bit positive integer seed using HMAC-SHA256:
 * HMAC_SHA256(key = serverSeed, data = `${clientSeed}:${nonce}`)
 */
export function deriveProvablyFairSeed(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): number {
  const hmac = createHmac("sha256", serverSeed);
  hmac.update(`${clientSeed}:${nonce}`, "utf8");
  const digest = hmac.digest();
  // Read first 4 bytes as unsigned 32-bit integer (ensuring non-zero positive integer)
  const rawSeed = digest.readUInt32BE(0);
  return rawSeed === 0 ? 0x9e3779b9 : rawSeed;
}

/** Create a fresh SeededRng driven by the provably fair seed. */
export function createProvablyFairRng(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): { rng: SeededRng; rngFn: RngFn; derivedSeed: number } {
  const derivedSeed = deriveProvablyFairSeed(serverSeed, clientSeed, nonce);
  const rng = new SeededRng(derivedSeed);
  const rngFn: RngFn = () => rng.nextFloat();
  return { rng, rngFn, derivedSeed };
}

/**
 * Verify a revealed Provably Fair proof:
 * 1. Confirms SHA-256(serverSeed) === serverSeedHash.
 * 2. Confirms HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`) === derivedSeed.
 */
export function verifyProvablyFairProof(proof: ProvablyFairProof): ProvablyFairVerification {
  const calculatedHash = hashServerSeed(proof.serverSeed);
  const calculatedSeed = deriveProvablyFairSeed(
    proof.serverSeed,
    proof.clientSeed,
    proof.nonce,
  );

  const hashMatches = calculatedHash.toLowerCase() === proof.serverSeedHash.toLowerCase();
  const seedMatches = calculatedSeed === proof.derivedSeed;

  return {
    valid: hashMatches && seedMatches,
    calculatedHash,
    calculatedSeed,
    hashMatches,
    seedMatches,
  };
}
