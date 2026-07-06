/**
 * Event loader — corrected (M-04).
 *
 * Previously events were registered as `(...args) => event.execute(...)` with
 * no try/catch, so any throw inside an event became an unhandled rejection.
 * Now each execute call is wrapped in a try/catch that logs a structured error
 * and never propagates, so one bad event handler cannot crash the process or
 * take down sibling handlers.
 */
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { client } from "../client.js";
import { log } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(): Promise<void> {
  const eventsPath = join(__dirname, "../events");
  const files = readdirSync(eventsPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of files) {
    const mod = await import(`../events/${file}`);
    const event = mod.default;
    if (!event?.name || !event?.execute) continue;

    const wrapped = async (...args: unknown[]) => {
      try {
        await event.execute(...args);
      } catch (err: any) {
        log.error(`Event handler threw: ${event.name}`, {
          error: err?.message,
          stack: err?.stack,
        });
      }
    };

    if (event.once) {
      client.once(event.name, wrapped);
    } else {
      client.on(event.name, wrapped);
    }
    log.debug("loaded event", { name: event.name, once: Boolean(event.once) });
  }
}
