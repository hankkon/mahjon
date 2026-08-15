/**
 * CLI entry — `pnpm --filter @taiwan-mahjong/server serve:web`
 *
 * Starts the authoritative game server AND serves the Godot HTML5 export
 * (`apps/player-client/export/web`) over plain HTTP, so the browser build
 * plays directly at http://localhost:3000.
 *
 * The NetworkManager browser default connects to `ws(s)://<page host>/ws` —
 * same origin, no manual URL editing needed.
 *
 * Usage:
 *   PORT=3000 pnpm --filter @taiwan-mahjong/server serve:web
 *   VARIANT=south pnpm --filter @taiwan-mahjong/server serve:web
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { startServer, SERVER_NAME, PROTOCOL_VERSION } from "./index.js";

const port = Number(process.env.PORT ?? 3000);
const variant = (process.env.VARIANT === "south" ? "south" : "north") as "north" | "south";
const timeoutMs = Number(process.env.TIMEOUT_MS ?? 15_000);
// AI 補位：開一個網頁就能打。ENABLE_AI=0 可關閉（例如對戰測試）。
const enableAi = process.env.ENABLE_AI !== "0";

// apps/server/src/serve-web.ts → apps/player-client/export/web
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.WEB_ROOT ?? join(here, "..", "..", "..", "..", "player-client", "export", "web");

if (!existsSync(webRoot)) {
  console.error(`[${SERVER_NAME}] webRoot not found: ${webRoot}`);
  console.error(`[${SERVER_NAME}] export the Godot project first:`);
  console.error(`  /Users/ian/Downloads/Godot.app/Contents/MacOS/Godot --headless --path apps/player-client --export-release "Web"`);
  process.exit(1);
}

const server = await startServer({ port, host: "0.0.0.0", variant, timeoutMs, webRoot, enableAi });

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${timeoutMs}ms`);
console.log(`[${SERVER_NAME}] ai-fill=${enableAi ? "ON (3 AIs: 初級/中級/高級)" : "OFF"}`);
console.log(`[${SERVER_NAME}] webRoot=${webRoot}`);
console.log(`[${SERVER_NAME}] listening on http://0.0.0.0:${server.port}`);
console.log(`[${SERVER_NAME}] Play:   http://localhost:${server.port}/`);
console.log(`[${SERVER_NAME}] WS:     ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);

const shutdown = async (): Promise<void> => {
  console.log(`[${SERVER_NAME}] shutting down…`);
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
