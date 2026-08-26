import { describe, it, expect } from "vitest";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  deriveProvablyFairSeed,
  createProvablyFairRng,
  verifyProvablyFairProof,
  type ProvablyFairProof,
} from "../provably-fair.js";
import { createDeal } from "../wall.js";

describe("Provably Fair (Stake-compliant verification)", () => {
  it("generates valid 256-bit server seeds and 128-bit client seeds", () => {
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();

    expect(serverSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(clientSeed).toMatch(/^[0-9a-f]{32}$/);

    // Multiple generations are unique
    expect(generateServerSeed()).not.toBe(serverSeed);
    expect(generateClientSeed()).not.toBe(clientSeed);
  });

  it("calculates deterministic SHA-256 server seed commitment", () => {
    const serverSeed = "d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f";
    const hash = hashServerSeed(serverSeed);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashServerSeed(serverSeed)).toBe(hash);
  });

  it("derives deterministic 32-bit positive integer seeds via HMAC-SHA256", () => {
    const serverSeed = "test-server-seed-secret-1234567890";
    const clientSeed = "client-seed-abc";
    const nonce = 1;

    const seed1 = deriveProvablyFairSeed(serverSeed, clientSeed, nonce);
    const seed2 = deriveProvablyFairSeed(serverSeed, clientSeed, nonce);

    expect(Number.isSafeInteger(seed1)).toBe(true);
    expect(seed1).toBeGreaterThan(0);
    expect(seed1).toBe(seed2);

    // Changing nonce changes seed
    const seedNonce2 = deriveProvablyFairSeed(serverSeed, clientSeed, 2);
    expect(seedNonce2).not.toBe(seed1);

    // Changing clientSeed changes seed
    const seedOtherClient = deriveProvablyFairSeed(serverSeed, "different-client", nonce);
    expect(seedOtherClient).not.toBe(seed1);

    // Changing serverSeed changes seed
    const seedOtherServer = deriveProvablyFairSeed("different-server-seed", clientSeed, nonce);
    expect(seedOtherServer).not.toBe(seed1);
  });

  it("verifies truthful proofs and rejects tampered proofs", () => {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = "room-custom-client-seed";
    const nonce = 5;
    const derivedSeed = deriveProvablyFairSeed(serverSeed, clientSeed, nonce);

    const validProof: ProvablyFairProof = {
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      derivedSeed,
    };

    // Truthful proof passes
    const res = verifyProvablyFairProof(validProof);
    expect(res.valid).toBe(true);
    expect(res.hashMatches).toBe(true);
    expect(res.seedMatches).toBe(true);

    // Tampered serverSeed
    const tamperedServerSeed: ProvablyFairProof = {
      ...validProof,
      serverSeed: generateServerSeed(),
    };
    expect(verifyProvablyFairProof(tamperedServerSeed).valid).toBe(false);

    // Tampered commitment hash
    const tamperedHash: ProvablyFairProof = {
      ...validProof,
      serverSeedHash: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    expect(verifyProvablyFairProof(tamperedHash).valid).toBe(false);

    // Tampered nonce
    const tamperedNonce: ProvablyFairProof = {
      ...validProof,
      nonce: 6,
    };
    expect(verifyProvablyFairProof(tamperedNonce).valid).toBe(false);

    // Tampered clientSeed
    const tamperedClientSeed: ProvablyFairProof = {
      ...validProof,
      clientSeed: "hacked-client-seed",
    };
    expect(verifyProvablyFairProof(tamperedClientSeed).valid).toBe(false);

    // Tampered derivedSeed
    const tamperedDerivedSeed: ProvablyFairProof = {
      ...validProof,
      derivedSeed: 123456789,
    };
    expect(verifyProvablyFairProof(tamperedDerivedSeed).valid).toBe(false);
  });

  it("replays the exact wall deal and dice rolls deterministically from seed proof", () => {
    const serverSeed = generateServerSeed();
    const clientSeed = "match-seed-proof";
    const nonce = 3;

    // Simulation 1: Original hand deal
    const { rngFn: rng1, derivedSeed } = createProvablyFairRng(serverSeed, clientSeed, nonce);
    const deal1 = createDeal("north", rng1, 0, [3, 4, 5]);

    // Simulation 2: Independent verification replay by player
    const proof: ProvablyFairProof = {
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed,
      nonce,
      derivedSeed,
    };

    expect(verifyProvablyFairProof(proof).valid).toBe(true);

    const { rngFn: replayRng } = createProvablyFairRng(proof.serverSeed, proof.clientSeed, proof.nonce);
    const replayDeal = createDeal("north", replayRng, 0, [3, 4, 5]);

    // Both deals must be 100% identical tile-for-tile across all hands and wall
    expect(replayDeal.hands).toEqual(deal1.hands);
    expect(replayDeal.flowers).toEqual(deal1.flowers);
    expect(replayDeal.wall).toEqual(deal1.wall);
    expect(replayDeal.headCursor).toBe(deal1.headCursor);
    expect(replayDeal.deckCursor).toBe(deal1.deckCursor);
  });
});
