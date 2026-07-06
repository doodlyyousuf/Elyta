/**
 * Player cache layer.
 *
 * One API request per UID per hour. The COMPLETE raw API response is stored
 * verbatim in `freefire_player_cache.api_response` (JSONB); every subcommand
 * reads only from the cache and never calls the API itself.
 *
 * Flow:
 *   getOrFetch(uid, region)
 *     → cache hit (row exists AND expires_at > NOW())  ⇒ return api_response
 *     → cache miss / expired                            ⇒ fetchPlayerInfoRaw()
 *                                                        ⇒ upsert row (1h TTL)
 *                                                        ⇒ return api_response
 *
 * Cleanup of expired rows is handled by cleanup.ts (runs every 5–10 min).
 */
import { supabase } from "../../database/supabase.js";
import { fetchPlayerInfoRaw, type Region } from "./api.js";
import { log } from "../logger.js";

const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CacheRow {
  uid: string;
  region: string;
  player_name: string | null;
  api_response: any;
  cached_at: string;
  expires_at: string;
}

export interface CacheResult {
  data: any; // the complete raw API response
  cacheHit: boolean;
  apiCalled: boolean;
  playerName: string | null;
}

function pickName(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  return (
    raw?.basicInfo?.nickname ??
    raw?.basicInfo?.name ??
    raw?.captainBasicInfo?.nickname ??
    raw?.nickname ??
    raw?.name ??
    null
  );
}

/** Read a cached row for (uid, region). Returns null if missing/expired. */
async function readCache(uid: string, region: string): Promise<CacheRow | null> {
  const { data, error } = await supabase
    .from("freefire_player_cache")
    .select("uid, region, player_name, api_response, cached_at, expires_at")
    .eq("uid", uid)
    .eq("region", region)
    .maybeSingle();

  if (error) {
    log.warn("freefire cache read failed", { error: error.message, uid, region });
    return null;
  }
  if (!data) return null;

  // Treat expired rows as a miss (cleanup.ts deletes them async).
  const expiresAt = new Date(data.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return null;
  }
  return data as CacheRow;
}

/** Upsert the complete raw response with a fresh 1h TTL. */
async function writeCache(uid: string, region: string, raw: any): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_MS);
  const { error } = await supabase
    .from("freefire_player_cache")
    .upsert(
      {
        uid,
        region,
        player_name: pickName(raw),
        api_response: raw,
        api_version: "v1",
        cached_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "uid,region" }
    );
  if (error) {
    log.warn("freefire cache write failed", { error: error.message, uid, region });
  }
}

/**
 * Get the complete player data — from cache if fresh, otherwise from the API.
 * This is the ONLY function in the module that may trigger an upstream call.
 */
export async function getOrFetch(uid: string, region: Region): Promise<CacheResult> {
  const cached = await readCache(uid, region);
  if (cached) {
    return {
      data: cached.api_response,
      cacheHit: true,
      apiCalled: false,
      playerName: cached.player_name,
    };
  }

  const raw = await fetchPlayerInfoRaw(uid, region);
  await writeCache(uid, region, raw);

  return {
    data: raw,
    cacheHit: false,
    apiCalled: true,
    playerName: pickName(raw),
  };
}

/** Force-refresh (used by /freefire lookup --refresh if ever added). */
export async function refresh(uid: string, region: Region): Promise<CacheResult> {
  const raw = await fetchPlayerInfoRaw(uid, region);
  await writeCache(uid, region, raw);
  return { data: raw, cacheHit: false, apiCalled: true, playerName: pickName(raw) };
}
