/**
 * Bot entry point — corrected (C-03, C-09, H-13, M-02, M-12, L-03, L-05).
 *
 * Key changes vs. the original:
 *  • C-09  There is NO duplicate `client.once("ready")` here any more. ALL
 *          startup logic lives in the single `events/ready.ts` handler that
 *          `loadEvents()` registers. The old code ran two competing ready
 *          handlers (double invite-cache, double giveaway interval).
 *  • C-03  DisTube is instantiated ONCE and attached as `client.distube` so
 *          music commands can read it from the client.
 *  • H-13  Each background task runs in its own interval with its own
 *          try/catch and an `isRunning` overlap guard, so one failing/slow
 *          subsystem cannot block or crash the others.
 *  • M-02  Global `unhandledRejection` / `uncaughtException` handlers are
 *          installed so a single rejected promise no longer kills the bot.
 *  • M-12  SIGTERM/SIGINT are handled: intervals stop, the client is destroyed,
 *          and the process exits cleanly.
 *  • L-05  `validateEnv()` runs first and fails fast on misconfiguration.
 *  • L-03  Uses the structured logger instead of raw console.log.
 */
import "dotenv/config";
import { validateEnv } from "./lib/env.js";
// Validate the full env schema up-front (fails fast with a clear message).
validateEnv();

import { client } from "./client.js";
import { loadEvents } from "./loaders/loadEvents.js";
import { log } from "./lib/logger.js";
import { stopAllBackgroundTasks } from "./lib/scheduler.js";
import { DisTube } from "distube";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN missing in .env");

// ── Process-level error handlers (M-02) ─────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  log.error("Uncaught exception", { error: err.message, stack: err.stack });
  // Continue running for uncaught exceptions in the main loop; the specific
  // event/command that threw is already isolated by the loadEvents wrapper
  // (M-04) and the interactionCreate try/catch. If this fires repeatedly the
  // operator should investigate; we avoid a hard crash that would take every
  // feature down at once.
});

client.on("error", (err) => log.error("Client error", { error: err.message }));

// ── Graceful shutdown (M-12) ────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutting down", { signal });
  stopAllBackgroundTasks();
  try {
    await client.destroy();
  } catch (err: any) {
    log.error("Error destroying client", { error: err?.message });
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ── Bootstrap ───────────────────────────────────────────────────────────────
await loadEvents();

// Instantiate DisTube once and attach it to the client (C-03). Music commands
// read it via `client.distube` / `interaction.client.distube`.
try {
  client.distube = new DisTube(client, {
    emitNewSongOnly: true,
  });
  log.info("DisTube initialised");
} catch (err: any) {
  // Music is optional; don't block boot if voice deps are missing.
  log.warn("DisTube failed to initialise — music commands disabled", { error: err?.message });
}

await client.login(token);
