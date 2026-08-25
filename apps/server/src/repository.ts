/**
 * RoomRepository — persistence abstraction for authoritative rooms.
 *
 * Stores fully serializable `RoomSnapshot` values (see room.ts). The in-memory
 * implementation backs tests; the SQLite implementation (sqlite.ts) survives
 * server restarts so rooms and their generation/executed-op state are durable.
 *
 * The repository is keyed by room id and is NOT responsible for timers,
 * sockets or AI — those are re-created by RoomManager after a restore.
 */

import type { Room } from "./room.js";
import type { RoomSnapshot } from "./room.js";

export interface RoomRepository {
  /** Persist a room's current snapshot (idempotent). */
  save(room: Room): void;
  /**
   * Optimistic compare-and-swap: only persist when the stored row still has
   * generation `expectedGeneration`. Returns false on conflict.
   */
  saveIfGeneration(room: Room, expectedGeneration: number): boolean;
  /** Load one snapshot by id (null when absent). */
  get(id: string): RoomSnapshot | null;
  /** All persisted snapshots. */
  list(): RoomSnapshot[];
  /** Remove a room snapshot. */
  delete(id: string): void;
  /** Release any held resources (SQLite handle). Optional. */
  close?(): void;
}

/** Test/in-memory repository — no durability across processes. */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly snapshots = new Map<string, RoomSnapshot>();

  save(room: Room): void {
    this.snapshots.set(room.id, room.serialize());
  }

  saveIfGeneration(room: Room, expectedGeneration: number): boolean {
    const existing = this.snapshots.get(room.id);
    if (existing !== undefined && existing.generationId !== expectedGeneration) {
      return false;
    }
    this.snapshots.set(room.id, room.serialize());
    return true;
  }

  get(id: string): RoomSnapshot | null {
    return this.snapshots.get(id) ?? null;
  }

  list(): RoomSnapshot[] {
    return [...this.snapshots.values()];
  }

  delete(id: string): void {
    this.snapshots.delete(id);
  }
}
