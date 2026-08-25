/**
 * Seat credentials (Phase 4) — HMAC bearer credential issue/verify + the WSS
 * reconnect gate (a player cannot take over another player's seat).
 */

import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { RoomManager } from "../roomManager.js";
import { InMemoryRoomRepository } from "../repository.js";
import { GameServer } from "../wss.js";
import {
  assertSeatCredentialSecret,
  DEFAULT_SEAT_CREDENTIAL_TTL_MS,
  issueSeatCredential,
  verifySeatCredential,
} from "../seat-credential.js";

const SECRET = "a-very-secret-key-with-at-least-32-bytes-!!!";

function startGames(): Promise<{ server: GameServer; url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const manager = new RoomManager({
      repository: new InMemoryRoomRepository(),
      roomOptions: { variant: "north" },
    });
    const server = new GameServer({ httpServer, manager, seatCredentialSecret: SECRET });
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        url: `ws://127.0.0.1:${port}/ws`,
        close: async () => {
          await server.close();
          await new Promise<void>((r) => httpServer.close(() => r()));
        },
      });
    });
  });
}

function join(socket: WebSocket, roomId: string, playerId?: string, seatCredential?: string): void {
  const payload: Record<string, unknown> = { type: "join", roomId, operationId: `j-${Math.random()}` };
  if (playerId !== undefined) payload.playerId = playerId;
  if (seatCredential !== undefined) payload.seatCredential = seatCredential;
  socket.send(JSON.stringify(payload));
}

function firstMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString()) as Record<string, unknown>));
  });
}

describe("seat-credential — issue / verify", () => {
  it("verifies a freshly issued credential", () => {
    const identity = { roomId: "r-abc", seat: 2, playerId: "p-1" };
    const credential = issueSeatCredential(SECRET, identity, {
      generation: 0,
      expiresAt: Date.now() + DEFAULT_SEAT_CREDENTIAL_TTL_MS,
    });
    expect(verifySeatCredential(SECRET, identity, 0, credential, Date.now())).toBe(true);
  });

  it("rejects a credential bound to a different seat / room / player", () => {
    const identity = { roomId: "r-abc", seat: 1, playerId: "p-1" };
    const credential = issueSeatCredential(SECRET, identity, {
      generation: 0,
      expiresAt: Date.now() + DEFAULT_SEAT_CREDENTIAL_TTL_MS,
    });
    expect(
      verifySeatCredential(SECRET, { roomId: "r-abc", seat: 2, playerId: "p-1" }, 0, credential, Date.now()),
    ).toBe(false);
    expect(
      verifySeatCredential(SECRET, { roomId: "r-other", seat: 1, playerId: "p-1" }, 0, credential, Date.now()),
    ).toBe(false);
    expect(
      verifySeatCredential(SECRET, { roomId: "r-abc", seat: 1, playerId: "p-2" }, 0, credential, Date.now()),
    ).toBe(false);
  });

  it("rejects expired credentials and wrong generations", () => {
    const identity = { roomId: "r-abc", seat: 0, playerId: "p-1" };
    const expired = issueSeatCredential(SECRET, identity, {
      generation: 0,
      expiresAt: Date.now() - 1,
    });
    expect(verifySeatCredential(SECRET, identity, 0, expired, Date.now())).toBe(false);

    const gen1 = issueSeatCredential(SECRET, identity, {
      generation: 1,
      expiresAt: Date.now() + DEFAULT_SEAT_CREDENTIAL_TTL_MS,
    });
    expect(verifySeatCredential(SECRET, identity, 0, gen1, Date.now())).toBe(false);
  });

  it("rejects a tampered signature and a non-credential string", () => {
    const identity = { roomId: "r-abc", seat: 0, playerId: "p-1" };
    const credential = issueSeatCredential(SECRET, identity, {
      generation: 0,
      expiresAt: Date.now() + DEFAULT_SEAT_CREDENTIAL_TTL_MS,
    });
    expect(verifySeatCredential(SECRET, identity, 0, `${credential}x`, Date.now())).toBe(false);
    expect(verifySeatCredential(SECRET, identity, 0, "nope", Date.now())).toBe(false);
    expect(verifySeatCredential(SECRET, identity, 0, 12345, Date.now())).toBe(false);
  });

  it("asserts the secret is at least 32 UTF-8 bytes", () => {
    expect(() => assertSeatCredentialSecret("too-short")).toThrow(/32/);
    expect(() => assertSeatCredentialSecret(SECRET)).not.toThrow();
  });
});

describe("WSS seat-credential gate — reconnect flow", () => {
  it("issues a credential on join and rejects a reconnect without it", async () => {
    const { server, url, close } = await startGames();
    try {
      const { room } = server.manager.createRoom();

      // First join: seat 0 for player "p1" → credential issued in events.
      const s1 = new WebSocket(url);
      await new Promise<void>((resolve) => s1.once("open", () => resolve()));
      join(s1, room.id, "p1");
      const joined1 = (await firstMessage(s1)) as { type: string; seatCredential?: string };
      expect(joined1.type).toBe("welcome");
      const credential = joined1.seatCredential!;
      expect(credential).toBeTruthy();
      s1.close();

      // Reconnect WITHOUT the credential → rejected.
      const s2 = new WebSocket(url);
      await new Promise<void>((resolve) => s2.once("open", () => resolve()));
      join(s2, room.id, "p1");
      const err = (await firstMessage(s2)) as { type: string; code?: string };
      expect(err.type).toBe("error");
      expect(err.code).toBe("invalid_credential");
      s2.close();

      // Reconnect WITH the credential → seat restored.
      const s3 = new WebSocket(url);
      await new Promise<void>((resolve) => s3.once("open", () => resolve()));
      join(s3, room.id, "p1", credential);
      const welcomed = (await firstMessage(s3)) as { type: string; roomId: string | null };
      expect(welcomed.type).toBe("welcome");
      expect(welcomed.roomId).toBe(room.id);
      s3.close();
    } finally {
      await close();
    }
  });

  it("rotation invalidates previously issued credentials", async () => {
    const { server, url, close } = await startGames();
    try {
      const { room } = server.manager.createRoom();
      const s1 = new WebSocket(url);
      await new Promise<void>((resolve) => s1.once("open", () => resolve()));
      join(s1, room.id, "p1");
      const joined1 = (await firstMessage(s1)) as { seatCredential?: string };
      const credential = joined1.seatCredential!;
      s1.close();

      server.rotateRoomCredentials(room.id);

      const s2 = new WebSocket(url);
      await new Promise<void>((resolve) => s2.once("open", () => resolve()));
      join(s2, room.id, "p1", credential);
      const err = (await firstMessage(s2)) as { type: string; code?: string };
      expect(err.code).toBe("invalid_credential");
      s2.close();
    } finally {
      await close();
    }
  });
});
