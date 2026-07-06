/**
 * Background-task scheduler with isolation + overlap guard (H-13).
 *
 * Each registered task runs on its own interval, wrapped in a try/catch and an
 * `isRunning` guard so that:
 *   • a throw inside one task is logged but cannot crash the others, and
 *   • a slow task does not overlap with itself.
 *
 * `stopAll()` clears every interval — called by the graceful-shutdown handler
 * in src/index.ts (M-12).
 */
import { log } from "./logger.js";

const handles: NodeJS.Timeout[] = [];

function scheduleTask(name: string, fn: () => Promise<void>, intervalMs: number): void {
  let running = false;
  const tick = async () => {
    if (running) return; // overlap guard
    running = true;
    try {
      await fn();
    } catch (err: any) {
      log.error(`Background task failed: ${name}`, { error: err?.message });
    } finally {
      running = false;
    }
  };
  handles.push(setInterval(tick, intervalMs));
}

export function registerBackgroundTask(
  name: string,
  fn: () => Promise<void>,
  intervalMs: number
): void {
  scheduleTask(name, fn, intervalMs);
}

export function stopAllBackgroundTasks(): void {
  for (const h of handles) clearInterval(h);
  handles.length = 0;
}
