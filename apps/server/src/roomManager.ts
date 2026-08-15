/**
 * RoomManager — owns the set of live rooms and player identities.
 *
 * Responsibilities:
 *  - create room (unique id) / join (max 4, reconnect restores seat).
 *  - track per-playerId rooms (one active room per player).
 *  - disconnect → mark seat disconnected (game pauses for reactions);
 *    reconnect with the same playerId restores the seat.
 *  - cleanup empty / ended rooms after a settle.
 */

import { randomBytes } from "node:crypto";
import { Room, type RoomOptions } from "./room.js";

export interface ManagerOptions {
  roomIdPrefix?: string;
  roomOptions?: Omit<RoomOptions, "id">;
}

const ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function randomId(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ID_CHARS[bytes[i]! % ID_CHARS.length];
  }
  return out;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  /** playerId → roomId (active room per player). */
  readonly playerRooms = new Map<string, string>();
  private readonly idPrefix: string;
  private readonly roomOptions: Omit<RoomOptions, "id">;

  constructor(options: ManagerOptions = {}) {
    this.idPrefix = options.roomIdPrefix ?? "r";
    this.roomOptions = options.roomOptions ?? { variant: "north" };
  }

  /** Attach a room-wide change listener (autoplay broadcasts) to new rooms. */
  setRoomChangeListener(fn: (room: Room) => void): void {
    this.roomOptions.onChange = fn;
  }

  createRoom(): { roomId: string; room: Room } {
    let roomId: string;
    do {
      roomId = `${this.idPrefix}${randomId(6)}`;
    } while (this.rooms.has(roomId));
    const room = new Room({ ...this.roomOptions, id: roomId });
    this.rooms.set(roomId, room);
    return { roomId, room };
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** Join (or rejoin) a room, assigning a fresh seat when the player is new. */
  join(roomId: string, playerId: string, playerName = "Player"): number {
    const room = this.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);
    const seat = room.join(playerId, playerName);
    this.playerRooms.set(playerId, roomId);
    return seat;
  }

  /** Reserve a seat for a brand-new player (creates the player identity). */
  newPlayerId(): string {
    return `p${randomId(10)}`;
  }

  playerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /** Disconnect: mark the seat disconnected (keeps the seat for reconnect). */
  disconnect(playerId: string): void {
    const room = this.playerRoom(playerId);
    if (room) room.setConnected(playerId, false);
  }

  /** Reconnect: restore the seat and mark it connected again. */
  reconnect(playerId: string): Room | undefined {
    const room = this.playerRoom(playerId);
    if (room) room.setConnected(playerId, true);
    return room;
  }

  /**
   * Cleanup: remove rooms that are empty (no connected players) — typically
   * after a game ends and the last player leaves. Returns the removed room ids.
   */
  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [roomId, room] of this.rooms) {
      const connected = room.players.some((p) => p?.connected);
      void now;
      if (!connected) {
        this.rooms.delete(roomId);
        for (const [pid, rid] of this.playerRooms) {
          if (rid === roomId) this.playerRooms.delete(pid);
        }
        removed.push(roomId);
      }
    }
    return removed;
  }
}
