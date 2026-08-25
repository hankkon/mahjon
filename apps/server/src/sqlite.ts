/**
 * SqliteRoomRepository — durable RoomRepository backend (node:sqlite).
 *
 * Stores the fully serializable RoomSnapshot as JSON in a single `rooms`
 * table with a `generation_id` column used for optimistic concurrency
 * (compare-and-swap) and a `schema_version` table for migrations.
 *
 * Requires Node.js >= 22.5.0 (`node:sqlite`). Uses WAL journaling so a crash
 * never leaves a half-written room row. The module is loaded via
 * `process.getBuiltinModule` so test runners (vite/vitest) do not try to
 * resolve the experimental builtin as a package.
 */

import type { DatabaseSync } from "node:sqlite";
import type { Room } from "./room.js";
import type { RoomSnapshot } from "./room.js";
import type { RoomRepository } from "./repository.js";

export const ROOM_SCHEMA_VERSION = 1;

interface RoomRow {
  id: string;
  variant: string;
  status: string;
  snapshot_json: string;
  generation_id: number;
  updated_at: number;
}

export class SqliteRoomRepository implements RoomRepository {
  readonly db: DatabaseSync;
  private closed = false;

  constructor(path: string) {
    const mod = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
    this.db = new mod.DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        id            TEXT PRIMARY KEY,
        variant       TEXT NOT NULL,
        status        TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        generation_id INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );
    `);
    const row = this.db
      .prepare("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
      .get() as { version: number } | undefined;
    if (!row) {
      this.db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(ROOM_SCHEMA_VERSION);
    } else if (row.version < ROOM_SCHEMA_VERSION) {
      throw new Error(
        `Room schema version ${row.version} is older than supported ${ROOM_SCHEMA_VERSION}`,
      );
    }
  }

  /** Upsert a room snapshot (overwrites by id). */
  save(room: Room): void {
    if (this.closed) return;
    const snap = room.serialize();
    const json = JSON.stringify(snap);
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO rooms (id, variant, status, snapshot_json, generation_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           variant = excluded.variant,
           status = excluded.status,
           snapshot_json = excluded.snapshot_json,
           generation_id = excluded.generation_id,
           updated_at = excluded.updated_at`,
      )
      .run(snap.id, snap.variant, snap.status, json, snap.generationId, now);
  }

  /**
   * Optimistic compare-and-swap save: only persists when the stored
   * generation matches `expectedGeneration`. Returns false on conflict
   * (the row was updated by someone else / a newer snapshot exists).
   */
  saveIfGeneration(room: Room, expectedGeneration: number): boolean {
    if (this.closed) return false;
    const snap = room.serialize();
    const result = this.db
      .prepare(
        `UPDATE rooms SET
           variant = ?, status = ?, snapshot_json = ?, generation_id = ?, updated_at = ?
         WHERE id = ? AND generation_id = ?`,
      )
      .run(
        snap.variant,
        snap.status,
        JSON.stringify(snap),
        snap.generationId,
        Date.now(),
        snap.id,
        expectedGeneration,
      );
    return result.changes === 1;
  }

  get(id: string): RoomSnapshot | null {
    if (this.closed) return null;
    const row = this.db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as
      | RoomRow
      | undefined;
    if (!row) return null;
    return JSON.parse(row.snapshot_json) as RoomSnapshot;
  }

  list(): RoomSnapshot[] {
    if (this.closed) return [];
    const rows = this.db.prepare("SELECT snapshot_json FROM rooms").all() as Array<{
      snapshot_json: string;
    }>;
    return rows.map((row) => JSON.parse(row.snapshot_json) as RoomSnapshot);
  }

  delete(id: string): void {
    if (this.closed) return;
    this.db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}
