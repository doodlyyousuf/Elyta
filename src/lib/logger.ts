/**
 * Lightweight structured logger (L-03).
 *
 * Replaces the scattered `console.log`/`console.error` calls with emoji-free
 * JSON-ish structured lines that include a level, timestamp, scope, and
 * optional context. Keeps a tiny surface so it is drop-in for existing call
 * sites while giving operators filterable output.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

function write(level: Level, scope: string, msg: string, ctx?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const ts = new Date().toISOString();
  const base = `${ts} [${level.toUpperCase()}] ${scope}: ${msg}`;
  if (ctx && Object.keys(ctx).length > 0) {
    try {
      process.stdout.write(`${base} ${JSON.stringify(ctx)}\n`);
    } catch {
      process.stdout.write(`${base}\n`);
    }
  } else {
    process.stdout.write(`${base}\n`);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", scope, msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => write("info", scope, msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", scope, msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => write("error", scope, msg, ctx),
  };
}

export const log = createLogger("bot");
