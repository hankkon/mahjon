/**
 * Tile Identity types for Taiwan 16-tile Mahjong.
 *
 * Authoritative Domain — `packages/rules`.
 * Tile identities are the smallest immutable unit of the game.
 */

/** Character suit 萬 */
export type Suit = "wan" | "tiao" | "tong";

/** Winds 風 */
export type Wind = "dong" | "nan" | "xi" | "bei";

/** Dragons 三元 */
export type Dragon = "zhong" | "fa" | "bai";

/** Flowers & Seasons 花 (北部 only): 梅蘭竹菊 + 春夏秋冬, one copy each (8 tiles). */
export type Flower = "mei" | "lan" | "zhu" | "ju" | "chun" | "xia" | "qiu" | "dong";

/** Honor ranks (non-numbered) */
export type Honor = Wind | Dragon;

/** Numbered suit tiles 1–9 */
export type Numbered = { kind: "numbered"; suit: Suit; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };

/** Honor tiles */
export type HonorTile = { kind: "honor"; honor: Honor };

/** Flower tiles */
export type FlowerTile = { kind: "flower"; flower: Flower };

/** Union of all physical tile identities */
export type Tile = Numbered | HonorTile | FlowerTile;

/** Simple string form for logs / tests / wire protocol: e.g. "wan:5", "honor:dong", "flower:mei" */
export type TileId = string;

/** A physical tile has a stable identity (its "species") + a unique instance id. */
export interface TileInstance {
  /** Identity of the tile (what it is). */
  tile: Tile;
  /** Unique instance id for this physical tile in the wall. */
  instanceId: number;
}

/** Serialize a Tile to a compact string identity. */
export function tileToId(tile: Tile): TileId {
  if (tile.kind === "flower") return `flower:${tile.flower}`;
  if (tile.kind === "honor") return `honor:${tile.honor}`;
  return `${tile.suit}:${tile.rank}`;
}

/** Deserialize a TileId back into a Tile. Throws on malformed input. */
export function tileFromId(id: TileId): Tile {
  const [category, value] = id.split(":");
  if (category === "flower") {
    return { kind: "flower", flower: value as Flower };
  }
  if (category === "honor") {
    return { kind: "honor", honor: value as Honor };
  }
  if (category === "wan" || category === "tiao" || category === "tong") {
    const rank = Number(value);
    if (!Number.isInteger(rank) || rank < 1 || rank > 9) {
      throw new Error(`Invalid tile id: ${id}`);
    }
    return { kind: "numbered", suit: category as Suit, rank: rank as Numbered["rank"] };
  }
  throw new Error(`Invalid tile id: ${id}`);
}

/** Build the full physical deck for a given variant. */
export function buildDeck(variant: "north" | "south"): Tile[] {
  const deck: Tile[] = [];

  for (const suit of ["wan", "tiao", "tong"] as const) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({ kind: "numbered", suit, rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
      }
    }
  }

  for (const wind of ["dong", "nan", "xi", "bei"] as const) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ kind: "honor", honor: wind });
    }
  }

  for (const dragon of ["zhong", "fa", "bai"] as const) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ kind: "honor", honor: dragon });
    }
  }

  if (variant === "north") {
    for (const flower of ["mei", "lan", "zhu", "ju", "chun", "xia", "qiu", "dong"] as const) {
      deck.push({ kind: "flower", flower });
    }
  }

  return deck;
}

/** North (北部) = 144 tiles, South (南部) = 136 tiles. */
export const DECK_SIZE = {
  north: 144,
  south: 136,
} as const;

/** Number of tiles each player receives at deal. */
export const DEAL_COUNT = {
  dealer: 17,
  nonDealer: 16,
} as const;

/** Fixed reserved tail size (尾 16 張) — never drawn by ordinary turns. */
export const TAIL_SIZE = 16;
