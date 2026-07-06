/**
 * Scheduled cleanup — deletes expired rows from freefire_player_cache.
 *
 * Runs on its own interval (every 5 minutes) from the ready handler, isolated
 * by the scheduler's per-task try/catch + overlap guard (H-13 pattern).
 *
 *   DELETE FROM freefire_player_cache WHERE expires_at < NOW();
 */
import { supabase } from "../../database/supabase.js";
import { log } from "../logger.js";

export async function cleanupExpiredFreeFireCache(): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("freefire_player_cache")
    .delete()
    .lt("expires_at", nowIso)
    .select("id");

  if (error) {
    log.warn("freefire cache cleanup failed", { error: error.message });
    return;
  }
  const deleted = Array.isArray(data) ? data.length : 0;
  if (deleted > 0) {
    log.info("freefire cache cleanup", { deleted });
  }
}
