/**
 * Bad-word (filtered-words) detection with per-guild TTL cache.
 *
 * Fixes M-03 (MEDIUM, Performance): previously `containsBadWord` hit Supabase
 * on EVERY message. For a chatty guild that meant dozens of round-trips per
 * second. Now the lowercased filtered-words list for each guild is cached
 * in-memory with a TTL (60s) and re-fetched only when stale.
 *
 * Signature preserved: `containsBadWord(content, guildId): Promise<boolean>`.
 *
 * The `invalidateBadWordsCache` helper is also exported so moderation
 * commands that add/remove filtered words can bust the cache immediately.
 */

import { supabase } from "../../database/supabase.js";

/** Cache TTL in milliseconds. */
const BAD_WORDS_TTL_MS = 60 * 1000;

interface CachedWords {
  words: string[];
  expires: number;
}

const cache = new Map<string, CachedWords>();

/**
 * Forces the next `containsBadWord` call for `guildId` to re-fetch from the
 * DB. Call this whenever a filtered word is added or removed for a guild.
 */
export function invalidateBadWordsCache(guildId: string): void {
  cache.delete(guildId);
}

/** Clears the entire cache (all guilds). Useful for tests / reloads. */
export function clearBadWordsCache(): void {
  cache.clear();
}

async function getWords(guildId: string): Promise<string[]> {
  const now = Date.now();
  const cached = cache.get(guildId);
  if (cached && cached.expires > now) {
    return cached.words;
  }

  const { data, error } = await supabase
    .from("filtered_words")
    .select("word")
    .eq("guild_id", guildId);

  if (error || !data?.length) {
    // Cache empty results too so we don't hammer the DB on a guild with no words.
    cache.set(guildId, { words: [], expires: now + BAD_WORDS_TTL_MS });
    return [];
  }

  const words = data
    .map((row: { word: string }) => (row.word ?? "").toLowerCase())
    .filter(Boolean);

  cache.set(guildId, { words, expires: now + BAD_WORDS_TTL_MS });
  return words;
}

/**
 * Returns true if `content` contains any of the guild's filtered words.
 * Filtered words are matched case-insensitively as substrings.
 */
export async function containsBadWord(
  content: string,
  guildId: string
): Promise<boolean> {
  const words = await getWords(guildId);
  if (words.length === 0) return false;
  const lower = content.toLowerCase();
  return words.some((w) => w.length > 0 && lower.includes(w));
}
