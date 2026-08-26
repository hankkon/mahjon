/**
 * Server configuration — consolidated env parsing.
 *
 * Ported from the reference implementation's server-config pattern: a single
 * typed surface over process.env with defaults, so serve.ts / serve-web.ts /
 * tests can share one source of truth.
 */

export interface ServerEnvConfig {
  host: string;
  port: number;
  variant: "north" | "south";
  timeoutMs: number;
  enableAi: boolean;
  sqlitePath: string | undefined;
  seatCredentialSecret: string | undefined;
  heartbeatIntervalMs: number;
  cleanupIntervalMs: number;
}

/**
 * Parse configuration from process.env. `aiDefault` controls the AI-fill
 * default: serve:web passes true (play-now out of the box), serve.ts passes
 * false (explicit ENABLE_AI=true).
 */
export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
  aiDefault = false,
): ServerEnvConfig {
  const enableAi = aiDefault
    ? env.ENABLE_AI !== "0"
    : env.ENABLE_AI === "true" || env.ENABLE_AI === "1";
  return {
    host: env.HOST ?? "0.0.0.0",
    port: Number(env.PORT ?? 3000),
    variant: env.VARIANT === "south" ? "south" : "north",
    timeoutMs: Number(env.TIMEOUT_MS ?? 15_000),
    enableAi,
    sqlitePath: env.SQLITE_PATH ? env.SQLITE_PATH : undefined,
    seatCredentialSecret: env.SEAT_CREDENTIAL_SECRET ? env.SEAT_CREDENTIAL_SECRET : undefined,
    heartbeatIntervalMs: Number(env.HEARTBEAT_INTERVAL_MS ?? 30_000),
    cleanupIntervalMs: Number(env.CLEANUP_INTERVAL_MS ?? 300_000),
  };
}
