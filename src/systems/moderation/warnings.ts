/**
 * Moderation warning helpers — shared DB access layer for warnings.
 *
 * Implements the previously-empty `src/systems/moderation/warnings.ts` so that
 * moderation commands (e.g. /warn, /warnings) and the dashboard share a single
 * source of truth for warning rows.
 *
 * Uses the shared Supabase client (fixes C-08) — never calls `createClient`
 * directly.
 *
 * Exports (signatures per task spec):
 *   - getWarnings(guildId, userId): Promise<any[]>
 *   - getWarningCount(guildId, userId): Promise<number>
 *   - addWarning(guildId, userId, moderatorId, reason): Promise<void>
 *   - clearWarnings(guildId, userId): Promise<void>
 *
 * `addWarning` rethrows on error so callers can wrap it in try/catch (the
 * /warn command does this to avoid replying success on a failed insert — H-14).
 */

import { supabase } from "../../database/supabase.js";

/** A row in the `warnings` table. */
export interface WarningRow {
  id?: number | string;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Fetch all warnings for a user in a guild, newest first.
 *
 * Returns `any[]` per the task spec so callers can map arbitrary columns
 * (e.g. dashboard columns the schema may add later) without churn here.
 */
export async function getWarnings(
  guildId: string,
  userId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("warnings")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

/** Count of warnings for a user in a guild. */
export async function getWarningCount(
  guildId: string,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("warnings")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Insert a warning row.
 *
 * Rethrows on error so callers can decide how to surface the failure
 * (e.g. the /warn command replies with the error message instead of success).
 */
export async function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.from("warnings").insert({
    guild_id: guildId,
    user_id: userId,
    moderator_id: moderatorId,
    reason,
  });

  if (error) throw error;
}

/** Delete all warnings for a user in a guild. */
export async function clearWarnings(
  guildId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("warnings")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Convenience type re-export for callers that want strict typing. */
export type { WarningRow as Warning };
