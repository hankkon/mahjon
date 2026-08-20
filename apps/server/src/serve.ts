/**
 * CLI entry — `pnpm --filter @taiwan-mahjong/server start`
 *
 * Starts the authoritative game server. The Godot client connects to
 * `ws://localhost:3000/ws` (see apps/player-client/README.md).
 *
 * Usage:
 *   PORT=3000 pnpm --filter @taiwan-mahjong/server start
 *   VARIANT=south pnpm --filter @taiwan-mahjong/server start
 */

import { startServer, SERVER_NAME, PROTOCOL_VERSION } from "./index.js";

const port = Number(process.env.PORT ?? 3000);
const variant = (process.env.VARIANT === "south" ? "south" : "north") as "north" | "south";
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 15_000);

const enableAi = process.env.ENABLE_AI === "true" || process.env.ENABLE_AI === "1";

const server = await startServer({ port, host: "0.0.0.0", variant, timeoutMs, enableAi });

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${timeoutMs}ms`);
console.log(`[${SERVER_NAME}] listening on http://0.0.0.0:${server.port}`);
console.log(`[${SERVER_NAME}] WebSocket endpoint: ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);

const shutdown = async (): Promise<void> => {
  console.log(`[${SERVER_NAME}] shutting down…`);
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
