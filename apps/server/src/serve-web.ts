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
import { loadServerConfig } from "./config.js";

const config = loadServerConfig(process.env, true);

// 編譯後本檔位於 <root>/apps/server/dist/apps/server/src/serve-web.js。
// webRoot 為 <root>/apps/player-client/export/web，需從 dist/.../src 往上 5 層
// 回到 <root>/apps（原 4 層會算成 apps/server/player-client/... → 找不到）。
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env.WEB_ROOT,
  join(here, "..", "..", "..", "..", "..", "..", "apps", "player-client", "export", "web"),
  join(here, "..", "..", "..", "..", "..", "player-client", "export", "web"),
  join(process.cwd(), "apps", "player-client", "export", "web"),
  join(process.cwd(), "player-client", "export", "web"),
];

let webRoot: string | undefined = undefined;
for (const cand of candidates) {
  if (cand && existsSync(cand)) {
    webRoot = cand;
    break;
  }
}

if (!webRoot) {
  console.warn(`[${SERVER_NAME}] Warning: webRoot static export not found in candidate paths.`);
}

const server = await startServer({
  port: config.port,
  host: config.host,
  variant: config.variant,
  timeoutMs: config.timeoutMs,
  webRoot,
  enableAi: config.enableAi,
  sqlitePath: config.sqlitePath,
  seatCredentialSecret: config.seatCredentialSecret,
});

console.log(`[${SERVER_NAME}] protocol v${PROTOCOL_VERSION} variant=${config.variant}`);
console.log(`[${SERVER_NAME}] thinking-timeout=${config.timeoutMs}ms`);
console.log(`[${SERVER_NAME}] ai-fill=${config.enableAi ? "ON (3 AIs: 初級/中級/高級)" : "OFF"}`);
if (config.sqlitePath) console.log(`[${SERVER_NAME}] persistence=sqlite path=${config.sqlitePath}`);
if (config.seatCredentialSecret) console.log(`[${SERVER_NAME}] seat-credentials=ON`);
console.log(`[${SERVER_NAME}] webRoot=${webRoot}`);
console.log(`[${SERVER_NAME}] listening on http://${config.host}:${server.port}`);
console.log(`[${SERVER_NAME}] Play:   http://localhost:${server.port}/`);
console.log(`[${SERVER_NAME}] WS:     ws://localhost:${server.port}/ws`);
console.log(`[${SERVER_NAME}] health: http://localhost:${server.port}/health`);
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
