/**
 * Persistence (Phase 1) — Room serialize/restore round-trip and the
 * RoomManager ↔ RoomRepository integration (in-memory backend).
 */

import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Room } from "../room.js";
import { RoomManager } from "../roomManager.js";
import { InMemoryRoomRepository } from "../repository.js";
import { SqliteRoomRepository } from "../sqlite.js";

function makePlayedRoom(): Room {
  const room = new Room({ id: "persist-room", variant: "north" });
  ["a", "b", "c", "d"].forEach((id) => room.join(id, `P${id.toUpperCase()}`));
  ["a", "b", "c", "d"].forEach((id) => room.setReady(id));
  return room;
}

describe("Room.serialize / Room.restore round-trip", () => {
  let room: Room;
  beforeEach(() => {
    room = makePlayedRoom();
  });

  it("restores an identical authoritative snapshot", () => {
    const snap = room.serialize();
    const restored = Room.restore(snap);
    expect(restored.id).toBe(room.id);
    expect(restored.status).toBe(room.status);
    expect(restored.generationId).toBe(room.generationId);
    expect(restored.players.map((p) => p?.playerId)).toEqual(
      room.players.map((p) => p?.playerId),
    );
    expect(restored.state).toEqual(room.state);
    expect(restored.dealerStreak).toBe(room.dealerStreak);
    expect(restored.executedSize).toBe(room.executedSize);
    // Snapshot JSON round-trips without loss (plain data).
    const reSerialized = Room.restore(JSON.parse(JSON.stringify(snap))).serialize();
    expect(reSerialized.state).toEqual(snap.state);
  });

  it("restored rooms are marked offline and stay paused until reconnect", () => {
    const restored = Room.restore(room.serialize());
    expect(restored.players.every((p) => p?.connected === false)).toBe(true);
    // Restored room does not schedule an autoplay timer immediately.
    expect(restored.phaseDeadline).toBeNull();
  });

  it("reconnect resumes control on a restored room", () => {
    const restored = Room.restore(room.serialize());
    restored.setConnected("a", true);
    expect(restored.players[0]?.connected).toBe(true);
  });

  it("restores the exact rng state (consumed sequence, not the seed)", () => {
    const seed = 424242;
    const a = new Room({ id: "rng-a", variant: "north", rngSeed: seed });
    ["a", "b", "c", "d"].forEach((id) => a.join(id, id.toUpperCase()));
    ["a", "b", "c", "d"].forEach((id) => a.setReady(id)); // deal consumes rng
    const snapA = a.serialize();

    // The room's internal rng advanced past the initial seed state.
    const fresh = new Room({ id: "rng-a", variant: "north", rngSeed: seed }).serialize();
    expect(snapA.rngState).not.toBe(fresh.rngState);

    // Restore resumes EXACTLY from the captured state.
    const b = Room.restore(snapA);
    expect(b.serialize().rngState).toBe(snapA.rngState);

    // And a restored room can start a fresh hand with EXACT same shuffle sequence as non-restarted room
    b.status = "ended";
    ["a", "b", "c", "d"].forEach((id) => b.setConnected(id, true));
    b.setReady("a"); // resetForNextRound → lobby
    ["a", "b", "c", "d"].forEach((id) => b.setReady(id));
    expect(b.status).toBe("playing");

    // Compare with room A if room A also proceeded to next round
    a.status = "ended";
    a.setReady("a");
    ["a", "b", "c", "d"].forEach((id) => a.setReady(id));
    expect(a.status).toBe("playing");

    // Both room A and restored room B have identical deal & wall shuffle for round 2
    expect(b.state!.wall.hands).toEqual(a.state!.wall.hands);
    expect(b.state!.wall.wall).toEqual(a.state!.wall.wall);
  });
});

describe("RoomManager + RoomRepository (in-memory)", () => {
  it("saves rooms on mutation and restores them in a fresh manager", () => {
    const repo = new InMemoryRoomRepository();
    const m1 = new RoomManager({ repository: repo });
    const { room } = m1.createRoom();
    room.join("a", "A");
    room.setReady("a");
    expect(repo.get(room.id)).not.toBeNull();

    // Simulate a restart: fresh manager sharing the same repository.
    const m2 = new RoomManager({ repository: repo });
    const restored = m2.loadPersisted();
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe(room.id);
    expect(restored[0]!.players[0]?.playerId).toBe("a");
    expect(restored[0]!.status).toBe("lobby");
    expect(m2.get(room.id)).toBeDefined();
  });

  it("restored playerRooms map lets a player rejoin their room", () => {
    const repo = new InMemoryRoomRepository();
    const m1 = new RoomManager({ repository: repo });
    const { room } = m1.createRoom();
    room.join("a", "A");
    room.join("b", "B");

    const m2 = new RoomManager({ repository: repo });
    m2.loadPersisted();
    expect(m2.playerRoom("a")?.id).toBe(room.id);
    expect(m2.playerRoom("b")?.id).toBe(room.id);
  });

  it("deleteRoom removes the snapshot from the repository", () => {
    const repo = new InMemoryRoomRepository();
    const m = new RoomManager({ repository: repo });
    const { room } = m.createRoom();
    room.join("a", "A");
    m.deleteRoom(room.id);
    expect(repo.get(room.id)).toBeNull();
    expect(m.rooms.size).toBe(0);
  });
});

describe("durable command dedup (Phase 3) — fingerprint", () => {
  it("replays idempotently and rejects same operationId with different content", () => {
    const room = makePlayedRoom(); // playing; dealer (a) must discard
    const tileId = room.state!.wall.hands[0]![0]!.instanceId;
    const first = room.handleCommand("a", {
      type: "discard",
      operationId: "op-d1",
      tileInstanceId: tileId,
      generationId: room.generationId,
    });
    expect(first.ok).toBe(true);

    // Idempotent replay — same id + same payload → ok without re-executing.
    const replay = room.handleCommand("a", {
      type: "discard",
      operationId: "op-d1",
      tileInstanceId: tileId,
      generationId: room.generationId,
    });
    expect(replay.ok).toBe(true);

    // Same id + DIFFERENT payload → rejected.
    const reuse = room.handleCommand("a", {
      type: "pass",
      operationId: "op-d1",
      generationId: room.generationId,
    });
    expect(reuse.ok).toBe(false);
    expect(reuse.error?.code).toBe("command_id_reused");
  });

  it("survives a restore: executed operationIds stay deduped and content-locked", () => {
    const room = makePlayedRoom();
    const tileId = room.state!.wall.hands[0]![0]!.instanceId;
    room.handleCommand("a", {
      type: "discard",
      operationId: "op-d2",
      tileInstanceId: tileId,
      generationId: room.generationId,
    });
    const restored = Room.restore(room.serialize());

    // Post-restart replay of the same id → idempotent ok.
    const replay = restored.handleCommand("a", {
      type: "discard",
      operationId: "op-d2",
      tileInstanceId: tileId,
      generationId: restored.generationId,
    });
    expect(replay.ok).toBe(true);

    // Post-restart reuse with different content → rejected (crash-replay safe).
    const reuse = restored.handleCommand("a", {
      type: "pass",
      operationId: "op-d2",
      generationId: restored.generationId,
    });
    expect(reuse.ok).toBe(false);
    expect(reuse.error?.code).toBe("command_id_reused");
  });
});

describe("SqliteRoomRepository — durable persistence", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mahjong-sqlite-"));
  });

  function sqlitePath(): string {
    return join(dir, "server.sqlite");
  }

  it("saves / loads / lists / deletes snapshots", () => {
    const repo = new SqliteRoomRepository(sqlitePath());
    const room = makePlayedRoom();
    repo.save(room);

    const loaded = repo.get(room.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(room.id);
    expect(loaded!.status).toBe("playing");
    expect(repo.list()).toHaveLength(1);

    repo.delete(room.id);
    expect(repo.get(room.id)).toBeNull();
    repo.close();
  });

  it("survives a server restart (new process = new repository, same file)", () => {
    const path = sqlitePath();
    let originalState = "";
    // First "process": create + play a room through the manager.
    {
      const repo = new SqliteRoomRepository(path);
      const m = new RoomManager({ repository: repo });
      const { room } = m.createRoom();
      room.join("a", "A");
      room.join("b", "B");
      room.join("c", "C");
      room.join("d", "D");
      room.setReady("a");
      room.setReady("b");
      room.setReady("c");
      room.setReady("d");
      expect(room.status).toBe("playing");
      expect(room.state).not.toBeNull();
      originalState = JSON.stringify(room.state);
      repo.close();
    }
    // Second "process": same file → rooms restored with authoritative state.
    {
      const repo2 = new SqliteRoomRepository(path);
      const m2 = new RoomManager({ repository: repo2 });
      const restored = m2.loadPersisted();
      expect(restored).toHaveLength(1);
      const room2 = restored[0]!;
      expect(room2.status).toBe("playing");
      expect(JSON.stringify(room2.state)).toBe(originalState);
      expect(room2.players.map((p) => p?.playerId)).toEqual(["a", "b", "c", "d"]);
      expect(m2.playerRoom("a")?.id).toBe(room2.id);
      repo2.close();
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("compare-and-swap save rejects stale generation writes", () => {
    const repo = new SqliteRoomRepository(sqlitePath());
    const room = makePlayedRoom();
    repo.save(room); // generation 1+ (after join/ready bumps)

    const expected = room.generationId;
    expect(repo.saveIfGeneration(room, expected)).toBe(true);

    // Simulate a concurrent stale writer: same room object with an OLD
    // expected generation → rejected, data unchanged.
    expect(repo.saveIfGeneration(room, expected - 1)).toBe(false);
    repo.close();
  });

  it("restores a mid-game room (authoritative state + generation) after restart", () => {
    const path = sqlitePath();
    const repo1 = new SqliteRoomRepository(path);
    const m1 = new RoomManager({ repository: repo1 });
    const { room } = m1.createRoom();
    ["a", "b", "c", "d"].forEach((id) => room.join(id, id.toUpperCase()));
    ["a", "b", "c", "d"].forEach((id) => room.setReady(id));
    expect(room.status).toBe("playing");
    // Make a real discard so the generation advances past the deal.
    const tileId = room.state!.wall.hands[0]![0]!.instanceId;
    const genBefore = room.generationId;
    const res = room.handleCommand("a", {
      type: "discard",
      operationId: "op-mid-1",
      tileInstanceId: tileId,
      generationId: genBefore,
    });
    expect(res.ok).toBe(true);
    const snapBefore = room.serialize();
    repo1.close();

    // Restart with a fresh manager/repository on the same file.
    const repo2 = new SqliteRoomRepository(path);
    const m2 = new RoomManager({ repository: repo2 });
    const restored = m2.loadPersisted();
    const room2 = restored[0]!;
    // The restored room reflects the discard (same authoritative state).
    expect(room2.state).not.toBeNull();
    expect(JSON.stringify(room2.state)).toBe(JSON.stringify(snapBefore.state));
    expect(room2.generationId).toBe(snapBefore.generationId);
    expect(room2.serialize().executed).toContainEqual(["op-mid-1", expect.any(String)]);
    // Players can reconnect and continue from the restored seat.
    room2.setConnected("a", true);
    expect(room2.players[0]?.connected).toBe(true);
    repo2.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("closing without deleting a room leaves it loadable", () => {
    const path = sqlitePath();
    const repo = new SqliteRoomRepository(path);
    const room = makePlayedRoom();
    repo.save(room);
    repo.close();
    const repo2 = new SqliteRoomRepository(path);
    expect(repo2.get(room.id)?.generationId).toBe(room.generationId);
    repo2.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("RoomManager persists authoritative snapshots on every mutation callback", () => {
    const path = sqlitePath();
    const repo = new SqliteRoomRepository(path);
    const manager = new RoomManager({ repository: repo });
    const { room } = manager.createRoom();

    const gen0 = room.generationId;
    expect(repo.get(room.id)?.generationId).toBe(gen0);

    room.join("p1", "Player 1");
    expect(repo.get(room.id)?.generationId).toBe(room.generationId);
    expect(room.generationId).toBeGreaterThan(gen0);

    const gen1 = room.generationId;
    room.join("p2", "Player 2");
    expect(repo.get(room.id)?.generationId).toBe(room.generationId);
    expect(room.generationId).toBeGreaterThan(gen1);

    repo.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
