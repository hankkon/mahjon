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
import { loadServerConfig } from "./config.js";

const config = loadServerConfig(process.env, false);

const server = await startServer({
  port: config.port,
  host: config.host,
  variant: config.variant,
  timeoutMs: config.timeoutMs,
  enableAi: config.enableAi,
  sqlitePath: config.sqlitePath,
  seatCredentialSecret: config.seatCredentialSecret,
});

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${config.variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${config.timeoutMs}ms`);
if (config.sqlitePath) console.log(`[${SERVER_NAME}] persistence=sqlite path=${config.sqlitePath}`);
if (config.seatCredentialSecret) console.log(`[${SERVER_NAME}] seat-credentials=ON`);
console.log(`[${SERVER_NAME}] listening on http://${config.host}:${server.port}`);
console.log(`[${SERVER_NAME}] WebSocket endpoint: ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);
// Machine-readable lifecycle event for supervisors (Docker/PM2): wait for
// this line before routing clients to the reported port.
console.log(
  JSON.stringify({
    event: "GAME_SERVER_READY",
    port: server.port,
    protocol: PROTOCOL_VERSION,
    sqlitePath: config.sqlitePath ?? null,
  }),
);

const shutdown = async (): Promise<void> => {
  console.log(`[${SERVER_NAME}] shutting down…`);
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
