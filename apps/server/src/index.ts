/**
 * @taiwan-mahjong/server — authoritative WebSocket (WSS) server entry.
 *
 * Starts an HTTP server (health probe) + the WebSocket endpoint at `/ws`.
 * Room lifecycle, Generation ID, command deduplication, and applying
 * `@taiwan-mahjong/rules` domain logic are handled by Room / RoomManager /
 * GameServer.
 */

import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RoomManager } from "./roomManager.js";
import { GameServer } from "./wss.js";
import { AiController } from "./aiController.js";
import { SqliteRoomRepository } from "./sqlite.js";
import type { RoomRepository } from "./repository.js";

export { Room } from "./room.js";
export { RoomManager } from "./roomManager.js";
export { GameServer, GameSocket } from "./wss.js";
export { AiController } from "./aiController.js";
export { buildClientSnapshot } from "./snapshot.js";
export { InMemoryRoomRepository } from "./repository.js";
export type { RoomRepository } from "./repository.js";
export { SqliteRoomRepository } from "./sqlite.js";
export { loadServerConfig } from "./config.js";
export * from "./protocol.js";

export const SERVER_NAME = "taiwan-mahjong-server";
export const PROTOCOL_VERSION = "1.0.0";

export interface ServerConfig {
  port?: number;
  host?: string;
  variant?: "north" | "south";
  /** Thinking-timeout for discard/reaction phases (ms). Default 15s. */
  timeoutMs?: number;
  /** Serve static files from this directory (e.g. the Godot HTML5 export). */
  webRoot?: string;
  /**
   * Auto-fill rooms with 3 AIs (初級/中級/高級) so a single human can open one
   * webpage and play immediately. Enabled by default in serve:web, disabled in
   * headless tests / stress runs that manage their own rooms.
   */
  enableAi?: boolean;
  /** SQLite path for durable rooms. When set, rooms survive restarts. */
  sqlitePath?: string;
  /** Seat credential HMAC secret (>=32 UTF-8 bytes). Enables credential checks. */
  seatCredentialSecret?: string;
  /** Server-side socket heartbeat ping interval (ms; <=0 disables). */
  heartbeatIntervalMs?: number;
  /** Background cleanup interval for empty/ended rooms in ms (default 300,000ms = 5min; <=0 disables). */
  cleanupIntervalMs?: number;
  /** Max WebSocket payload size in bytes (default 64KB). */
  maxPayloadBytes?: number;
  /** Max commands allowed per connection per rate limit window (default 50). */
  rateLimitMaxCommands?: number;
  /** Command rate limit window in ms (default 1000ms). */
  rateLimitWindowMs?: number;
  /** Max error responses sent per window before dampening (default 10). */
  maxErrorsPerWindow?: number;
  /** Max consecutive errors before terminating connection (default 20). */
  maxConsecutiveErrors?: number;
}

export interface RunningServer {
  httpServer: ReturnType<typeof createServer>;
  manager: RoomManager;
  games: GameServer;
  port: number;
  stop: () => Promise<void>;
  /** The AI controller — null when AI filling is disabled. */
  ai: AiController | null;
}

// --- Static file serving for the Godot HTML5 export (serve:web) ---

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pck": "application/octet-stream",
};

function resolveWebPath(webRoot: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  // Strip the leading "/" — path.resolve(webRoot, "/x") would discard webRoot
  // (it treats the second arg as an absolute path) and break every static hit.
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  // resolve() → absolute path so the traversal guard compares like-for-like
  // even when webRoot is passed as a relative path (e.g. WEB_ROOT=../...).
  const candidate = resolve(webRoot, rel);
  // Prevent path traversal outside webRoot.
  const root = resolve(webRoot);
  if (!candidate.startsWith(root + sep) && candidate !== root) return null;
  return candidate;
}

function serveStatic(webRoot: string, reqUrl: string, res: ServerResponse): void {
  const file = resolveWebPath(webRoot, reqUrl);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    // SPA fallback to index.html (Godot Web needs the loader at every route).
    const index = join(webRoot, "index.html");
    if (existsSync(index)) {
      res.writeHead(200, { "content-type": MIME[".html"] });
      createReadStream(index).pipe(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(file).pipe(res);
}

/** Start the authoritative game server on the given port. */
export async function startServer(config: ServerConfig = {}): Promise<RunningServer> {
  const {
    port = 3000,
    host = "0.0.0.0",
    variant = "north",
    timeoutMs,
    webRoot,
    enableAi = false,
  } = config;

  const startedAt = new Date().toISOString();
  let totalCleanedRooms = 0;
  const repository: RoomRepository | null = config.sqlitePath
    ? new SqliteRoomRepository(config.sqlitePath)
    : null;
  const manager = new RoomManager({ roomOptions: { variant, timeoutMs }, repository: repository ?? undefined });

  // Periodic background room cleanup (removes empty rooms with no active players)
  const cleanupIntervalMs = config.cleanupIntervalMs ?? 300_000;
  let cleanupTimer: NodeJS.Timeout | null = null;
  if (cleanupIntervalMs > 0) {
    cleanupTimer = setInterval(() => {
      const removed = manager.cleanup();
      if (removed.length > 0) {
        totalCleanedRooms += removed.length;
      }
    }, cleanupIntervalMs);
  }

  const httpServer = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/healthz") {
      const mem = process.memoryUsage();
      let executedEstimate = 0;
      let playingRooms = 0;
      for (const room of manager.rooms.values()) {
        executedEstimate += room.executedSize;
        if (room.status === "playing") playingRooms++;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          name: SERVER_NAME,
          protocol: PROTOCOL_VERSION,
          ok: true,
          startedAt,
          uptimeSec: Math.floor(process.uptime()),
          pid: process.pid,
          memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
          sockets: games.socketCount,
          rooms: manager.rooms.size,
          playingRooms,
          totalCleanedRooms,
          executedEstimate,
        }),
      );
      return;
    }

    const cleanUrl = (req.url ?? "/").split("?")[0];
    if (cleanUrl === "/verify" || cleanUrl === "/verify.html") {
      const here = dirname(fileURLToPath(import.meta.url));
      const verifyCandidates = [
        join(here, "public", "verify.html"),
        join(here, "..", "src", "public", "verify.html"),
        join(process.cwd(), "apps", "server", "src", "public", "verify.html"),
        join(process.cwd(), "src", "public", "verify.html"),
      ];
      for (const p of verifyCandidates) {
        if (existsSync(p)) {
          res.writeHead(200, { "content-type": MIME[".html"] });
          createReadStream(p).pipe(res);
          return;
        }
      }
    }

    if (webRoot) {
      serveStatic(webRoot, req.url ?? "/", res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  });

  const games = new GameServer({
    httpServer,
    manager,
    seatCredentialSecret: config.seatCredentialSecret,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    maxPayloadBytes: config.maxPayloadBytes,
    rateLimitMaxCommands: config.rateLimitMaxCommands,
    rateLimitWindowMs: config.rateLimitWindowMs,
    maxErrorsPerWindow: config.maxErrorsPerWindow,
    maxConsecutiveErrors: config.maxConsecutiveErrors,
  });
  // Auto-fill + drive the 3 AIs (初級/中級/高級) for the play-now web flow.
  const ai = enableAi ? new AiController(manager, games) : null;
  ai?.start();

  // Crash recovery: restore persisted rooms. They are marked offline and pause
  // their timers until the players' sockets reconnect (join with playerId).
  manager.loadPersisted((room) => games.broadcastRoom(room));

  const actualPort = await new Promise<number>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      const addr = httpServer.address();
      resolve(typeof addr === "object" && addr ? addr.port : port);
    });
  });

  const stop = async (): Promise<void> => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    ai?.stop();
    await games.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    repository?.close?.();
  };

  return { httpServer, manager, games, port: actualPort, stop, ai };
}

export function placeholder(): { name: string; protocol: string } {
  return { name: SERVER_NAME, protocol: PROTOCOL_VERSION };
}
