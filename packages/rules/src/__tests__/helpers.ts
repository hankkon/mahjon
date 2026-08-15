/**
 * Shared test helpers: build tile instances from compact id strings.
 */

import { tileFromId, type TileInstance } from "../tiles.js";

let nextId = 1000;

/** Build TileInstance[] from ids like "wan:1", "honor:dong", "flower:mei". */
export function tiles(...ids: string[]): TileInstance[] {
  return ids.map((id) => ({
    tile: tileFromId(id),
    instanceId: nextId++,
  }));
}

/** Build a single TileInstance from an id. */
export function tile(id: string): TileInstance {
  return tiles(id)[0]!;
}

/** Reset the id counter (call in beforeEach when determinism matters). */
export function resetIds(): void {
  nextId = 1000;
}
