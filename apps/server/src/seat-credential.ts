/**
 * Seat credentials — HMAC time-bound bearer credentials for seats.
 *
 * Ported from the reference implementation (V1 seat-credential.ts), adapted
 * to this server's 0-3 seat numbering and room-id identity.
 *
 * A credential is `v1.<generation>.<expiresAt>.<signature>` where the signature
 * is HMAC-SHA256 over `roomId \0 seat \0 playerId \0 generation \0 expiresAt`.
 * Reconnecting with a playerId requires a valid, unexpired credential bound to
 * the exact room/seat/player — a player cannot guess into another player's
 * seat, and expired/rotated credentials are rejected.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SEAT_CREDENTIAL_SIGNATURE_LENGTH = 43;
export const MINIMUM_CREDENTIAL_SECRET_BYTES = 32;
export const DEFAULT_SEAT_CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1_000;

export interface SeatCredentialLifecycle {
  generation: number;
  expiresAt: number;
}

export interface SeatCredentialIdentity {
  roomId: string;
  seat: number;
  playerId: string;
}

interface ParsedSeatCredential extends SeatCredentialLifecycle {
  signature: string;
}

function assertIdentifier(value: unknown, fieldName: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    value.trim() !== value
  ) {
    throw new Error(`${fieldName} must be a non-empty canonical identifier.`);
  }
}

function assertSafeCount(value: unknown, fieldName: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }
}

export function assertSeatCredentialSecret(secret: unknown): asserts secret is string {
  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_CREDENTIAL_SECRET_BYTES ||
    Buffer.byteLength(secret, "utf8") > 4_096
  ) {
    throw new Error(
      `Seat credential secret must contain between ${MINIMUM_CREDENTIAL_SECRET_BYTES} and 4096 UTF-8 bytes.`,
    );
  }
}

function parseSeatCredential(value: unknown): ParsedSeatCredential | null {
  if (typeof value !== "string") return null;
  const match = /^v1\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (match === null) return null;
  const generation = Number(match[1]);
  const expiresAt = Number(match[2]);
  if (
    !Number.isSafeInteger(generation) ||
    !Number.isSafeInteger(expiresAt) ||
    generation < 0 ||
    expiresAt <= 0
  ) {
    return null;
  }
  return { generation, expiresAt, signature: match[3]! };
}

export function isSeatCredential(value: unknown): value is string {
  return parseSeatCredential(value) !== null;
}

function deriveSeatCredentialSignature(
  secret: string,
  identity: SeatCredentialIdentity,
  lifecycle: SeatCredentialLifecycle,
): string {
  assertSeatCredentialSecret(secret);
  assertIdentifier(identity.roomId, "Room ID");
  assertIdentifier(identity.playerId, "Player ID");
  assertSafeCount(identity.seat, "Seat");
  if (identity.seat < 0 || identity.seat > 3) {
    throw new Error("Seat credential identity requires a 0-3 seat.");
  }
  assertSafeCount(lifecycle.generation, "Seat credential generation");
  assertSafeCount(lifecycle.expiresAt, "Seat credential expiration");
  if (lifecycle.expiresAt === 0) {
    throw new Error("Seat credential expiration must be positive.");
  }
  return createHmac("sha256", secret)
    .update("taiwan-mahjong:v1:seat-credential\0", "utf8")
    .update(identity.roomId, "utf8")
    .update("\0", "utf8")
    .update(String(identity.seat), "utf8")
    .update("\0", "utf8")
    .update(identity.playerId, "utf8")
    .update("\0", "utf8")
    .update(String(lifecycle.generation), "utf8")
    .update("\0", "utf8")
    .update(String(lifecycle.expiresAt), "utf8")
    .digest("base64url");
}

/** Issue a time-bound bearer credential for one seat. */
export function issueSeatCredential(
  secret: string,
  identity: SeatCredentialIdentity,
  lifecycle: SeatCredentialLifecycle,
): string {
  const signature = deriveSeatCredentialSignature(secret, identity, lifecycle);
  return `v1.${lifecycle.generation}.${lifecycle.expiresAt}.${signature}`;
}

/** Verify binding, generation, signature, and expiration at server time. */
export function verifySeatCredential(
  secret: string,
  identity: SeatCredentialIdentity,
  expectedGeneration: number,
  credential: unknown,
  currentTime: number,
): boolean {
  const parsed = parseSeatCredential(credential);
  if (parsed === null) return false;
  if (
    !Number.isSafeInteger(currentTime) ||
    currentTime < 0 ||
    parsed.generation !== expectedGeneration ||
    currentTime >= parsed.expiresAt
  ) {
    return false;
  }
  const expected = deriveSeatCredentialSignature(secret, identity, parsed);
  return timingSafeEqual(Buffer.from(parsed.signature), Buffer.from(expected));
}
