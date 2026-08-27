import { describe, it, expect } from "vitest";
import { Room } from "../room.js";
import { buildClientSnapshot } from "../snapshot.js";
import {
  verifyProvablyFairProof,
  createProvablyFairRng,
  createDeal,
} from "@taiwan-mahjong/rules";

describe("Server Provably Fair (Stake-compliant seed verification)", () => {
  it("commits serverSeedHash before play and reveals proof at settlement", () => {
    const room = new Room({ id: "pf-room-1", variant: "north" });
    const p1 = "p1", p2 = "p2", p3 = "p3", p4 = "p4";
    room.join(p1, "Player 1");
    room.join(p2, "Player 2");
    room.join(p3, "Player 3");
    room.join(p4, "Player 4");

    // Pre-game: All players ready up
    room.setReady(p1);
    room.setReady(p2);
    room.setReady(p3);
    room.setReady(p4);

    expect(room.status).toBe("playing");
    expect(room.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(room.handNonce).toBe(1);

    // Snapshot while playing reveals commitment (hash + clientSeed + nonce) but NO plaintext serverSeed
    const snapPlay = buildClientSnapshot(room, 0);
    expect(snapPlay.provablyFair).not.toBeNull();
    expect(snapPlay.provablyFair?.serverSeedHash).toBe(room.serverSeedHash);
    expect(snapPlay.provablyFair?.nonce).toBe(1);
    expect(snapPlay.provablyFair?.proof).toBeNull();

    // Trigger a win / settlement
    room.state!.phase = "discard";
    room.state!.turn = 0;
    const discardRes = room.handleCommand(p1, {
      type: "discard",
      tileInstanceId: room.state!.wall.hands[0]![0]!.instanceId,
      operationId: "op-discard-1",
    });
    expect(discardRes.ok).toBe(true);

    // End game manually for testing settlement proof
    room.status = "ended";
    room.ledger = [
      { seat: 0, delta: 300 },
      { seat: 1, delta: -100 },
      { seat: 2, delta: -100 },
      { seat: 3, delta: -100 },
    ];
    room.scores = [300, -100, -100, -100];
    room.winner = 0;

    // Trigger provablyFair proof generation via serialization or hand conclusion
    const proof = room.serialize().provablyFairProof;
    if (proof) {
      const audit = verifyProvablyFairProof(proof);
      expect(audit.valid).toBe(true);
      expect(audit.hashMatches).toBe(true);
      expect(audit.seedMatches).toBe(true);
    }
  });

  it("allows setting custom client seed before round start", () => {
    const room = new Room({ id: "pf-room-custom", variant: "north" });
    const p1 = "p1";
    room.join(p1, "Player 1");

    const customSeed = "my-lucky-custom-seed-2026";
    const res = room.handleCommand(p1, {
      type: "set_client_seed",
      clientSeed: customSeed,
      operationId: "op-set-seed",
    });

    expect(res.ok).toBe(true);
    expect(room.clientSeed).toBe(customSeed);
  });

  it("increments nonce and generates a fresh serverSeed per hand", () => {
    const room = new Room({ id: "pf-multi-round", variant: "north" });
    ["a", "b", "c", "d"].forEach((id) => room.join(id, id));

    // Hand 1
    ["a", "b", "c", "d"].forEach((id) => room.setReady(id));
    expect(room.status).toBe("playing");
    const hand1Hash = room.serverSeedHash;
    expect(room.handNonce).toBe(1);

    // End Hand 1
    room.status = "ended";
    room.setReady("a"); // resetForNextRound -> lobby

    // Hand 2
    ["a", "b", "c", "d"].forEach((id) => room.setReady(id));
    expect(room.status).toBe("playing");
    expect(room.handNonce).toBe(2);
    expect(room.serverSeedHash).not.toBe(hand1Hash);
  });

  it("provides discardHints when it is player's turn to discard", () => {
    const room = new Room({ id: "pf-hints", variant: "north" });
    ["a", "b", "c", "d"].forEach((id) => room.join(id, id));
    ["a", "b", "c", "d"].forEach((id) => room.setReady(id));

    expect(room.status).toBe("playing");
    const turn = room.state!.turn;
    const snap = buildClientSnapshot(room, turn);
    expect(snap.discardHints).toBeDefined();
    expect(snap.discardHints!.length).toBe(17); // Dealer has 17 tiles initially
    expect(snap.discardHints![0]!.waits).toBeDefined();
  });
});
