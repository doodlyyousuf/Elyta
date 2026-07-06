/**
 * AutoMod violation tracking & graduated punishment ladder.
 *
 * Fixes:
 *  - H-02 (HIGH): `violationTracker` was a per-key number that never decayed,
 *    so a user who tripped automod once a year ago was permanently one
 *    violation from a re-kick. Now stores `{ count, lastAt }` per key and
 *    resets the count to 0 when `now - lastAt > AUTOMOD.VIOLATION_DECAY_MS`.
 *  - H-03 (HIGH): `resetViolations` is now exported so the caller (or this
 *    module itself, right after a successful kick) can wipe a user's record.
 *    `applyAutoPunishment` calls `resetViolations` internally after a
 *    successful kick — the user was removed from the guild, so leaving a
 *    stale count around just punishes them again on rejoin.
 *  - C-08: already imports the shared supabase client. Preserved.
 *
 * Signatures preserved:
 *   - `recordViolation(guildId, userId): number`  — returns the NEW count.
 *   - `applyAutoPunishment(message, reason, count): Promise<string | null>`.
 *
 * Tunables come from `AUTOMOD.PUNISH.*` and `AUTOMOD.MUTE_DURATION_MS`.
 */

import type { Message } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { AUTOMOD } from "../../config.js";

interface ViolationEntry {
  count: number;
  lastAt: number;
}

const violationTracker = new Map<string, ViolationEntry>();

function getKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

/**
 * Records a violation for `userId` in `guildId` and returns the NEW count
 * (after decay + increment).
 */
export function recordViolation(guildId: string, userId: string): number {
  const key = getKey(guildId, userId);
  const now = Date.now();
  const entry = violationTracker.get(key);

  // H-02: decay — if the previous violation is older than the decay window,
  // reset the count before incrementing.
  let count: number;
  if (!entry || now - entry.lastAt > AUTOMOD.VIOLATION_DECAY_MS) {
    count = 1;
  } else {
    count = entry.count + 1;
  }

  violationTracker.set(key, { count, lastAt: now });
  return count;
}

/**
 * Returns the current violation count for `userId` in `guildId` (without
 * incrementing). Convenience for callers/tests.
 */
export function getViolationCount(guildId: string, userId: string): number {
  const entry = violationTracker.get(getKey(guildId, userId));
  if (!entry) return 0;
  // Apply decay on read too, so a stale count isn't reported forever.
  if (Date.now() - entry.lastAt > AUTOMOD.VIOLATION_DECAY_MS) return 0;
  return entry.count;
}

/**
 * Wipes the in-memory violation record for `userId` in `guildId`. (H-03)
 *
 * Should be called after a kick/ban so the user isn't one violation away
 * from a re-kick forever (or on rejoin). `applyAutoPunishment` already
 * calls this internally right after a successful kick.
 */
export function resetViolations(guildId: string, userId: string): void {
  violationTracker.delete(getKey(guildId, userId));
}

export type PunishmentResult = "warned" | "muted" | "kicked" | null;

/**
 * Applies the next step on the punishment ladder based on `count`:
 *   count >= AUTOMOD.PUNISH.KICK  → kick   (then resets violations — user is gone)
 *   count >= AUTOMOD.PUNISH.MUTE  → timeout for AUTOMOD.MUTE_DURATION_MS
 *   count >= AUTOMOD.PUNISH.WARN  → persist a warning row
 *
 * Returns a tag describing the action taken, or `null` if no action was
 * applicable / possible (e.g. member not moderatable).
 *
 * Moderators (ManageMessages) are NOT exempt here — `messageCreate` decides
 * who is exempt from which filters. By the time we reach this function the
 * violation has already been deemed actionable.
 */
export async function applyAutoPunishment(
  message: Message,
  reason: string,
  count: number
): Promise<PunishmentResult> {
  const member = message.member;
  if (!member || !message.guild) return null;

  if (count >= AUTOMOD.PUNISH.KICK) {
    if (member.kickable) {
      await member.kick(`AutoMod: ${reason} (${count} violations)`);
      // H-03: the user has been removed — wipe their counter so a rejoin
      // doesn't put them one violation from another kick.
      resetViolations(message.guild.id, message.author.id);
      return "kicked";
    }
    return null;
  }

  if (count >= AUTOMOD.PUNISH.MUTE) {
    if (member.moderatable) {
      await member.timeout(
        AUTOMOD.MUTE_DURATION_MS,
        `AutoMod: ${reason} (${count} violations)`
      );
      return "muted";
    }
    return null;
  }

  if (count >= AUTOMOD.PUNISH.WARN) {
    await supabase.from("warnings").insert({
      guild_id: message.guild.id,
      user_id: message.author.id,
      reason: `AutoMod: ${reason}`,
      moderator_id: message.client.user?.id ?? null,
    });
    return "warned";
  }

  return null;
}
