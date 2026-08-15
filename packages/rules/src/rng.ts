/**
 * RNG layer for the authoritative domain.
 *
 * Uses the decentralized randomness beacon `@drand/client` when available
 * (fetched randomness), falling back to a cryptographically secure local PRNG
 * (Node `crypto`) seeded per-game for deterministic replay/audit.
 */

import { createHash, randomBytes } from "node:crypto";

/** A PRNG function yielding floats in [0, 1). */
export type RngFn = () => number;

/** Seeded 32-bit xorshift PRNG — deterministic for a given seed. */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed <= 0) {
      throw new Error(`SeededRng requires a positive safe-integer seed, got ${seed}`);
    }
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Advance the xorshift32 state and return a float in [0, 1). */
  nextFloat(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

/** Build a callable `RngFn` from a SeededRng instance. */
export function rngFromSeed(seed: number): RngFn {
  const rng = new SeededRng(seed);
  return () => rng.nextFloat();
}

/** Create a new secure random seed (crypto-safe). */
export function randomSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

/** Deterministic seed derived from an entropy string (for reproducible games). */
export function seedFromString(input: string): number {
  const hash = createHash("sha256").update(input).digest();
  return hash.readUInt32BE(0) >>> 0 || 1;
}

/**
 * Fetch a drand beacon randomness round and derive a seed from it.
 * `drand-client`'s `fetchBeacon` returns a `RandomnessBeacon` whose
 * `randomness` field is a hex-encoded string. We hash it to a 32-bit seed.
 * Falls back to a local secure seed if the network is unavailable or drand
 * fails, so the game is never blocked on external availability.
 */
export async function drandSeed(): Promise<number> {
  try {
    const { HttpCachingChain, HttpChainClient, fetchBeacon } = await import("drand-client");
    const chain = new HttpCachingChain("https://api.drand.sh");
    const client = new HttpChainClient(chain);
    const beacon = await fetchBeacon(client);
    const seed = seedFromString(beacon.randomness);
    return seed;
  } catch {
    // Decentralized beacon unavailable — fall back to local CSPRNG.
    return randomSeed();
  }
}

/** Fisher-Yates shuffle of an array using the given RNG. Returns the same array. */
export function shuffle<T>(array: T[], rng: RngFn): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = array[i] as T;
    array[i] = array[j] as T;
    array[j] = tmp;
  }
  return array;
}

export type { RandomnessBeacon } from "drand-client";
