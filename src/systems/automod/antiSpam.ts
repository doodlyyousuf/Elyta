/**
 * In-memory anti-spam detector used by `messageCreate`.
 *
 * This is the canonical in-memory implementation (H-11 architecture cleanup).
 * The DB-backed `src/systems/antispam/antispam.ts` is left intact for callers
 * that may still reference it, but `messageCreate` uses THIS module via
 * `isSpamming`.
 *
 * Fixes:
 *  - H-02 (HIGH): previously keyed by `userId` only, so messages across
 *    guilds accumulated into one counter. Now keyed by `${guildId}:${userId}`.
 *  - H-03 (HIGH): spam history was never cleared after a violation, so every
 *    subsequent message still exceeded the threshold. Now `clearSpamHistory`
 *    is exported so the messageCreate handler / punishment layer can reset
 *    the counter after handling a violation. Time-based decay (resetting the
 *    count when outside the spam window) is preserved.
 *  - H-11 (HIGH): tunables are now sourced from `AUTOMOD` in `config.ts`
 *    instead of local magic numbers.
 *
 * Signature preserved: `isSpamming(userId: string, message: Message): boolean`.
 */

import type { Message } from "discord.js";
import { AUTOMOD } from "../../config.js";

interface SpamEntry {
  count: number;
  last: number;
}

const tracker = new Map<string, SpamEntry>();

function getKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

/**
 * Records a message from `userId` in `message.guild` and returns true if the
 * user has now exceeded the spam threshold within the rolling window.
 *
 * The `message` parameter is required (and was previously ignored) so the
 * counter can be scoped per-guild — fixing H-02.
 */
export function isSpamming(userId: string, message: Message): boolean {
  const guildId = message.guildId ?? message.guild?.id;
  if (!guildId) return false; // DMs / uncached guilds can't be spam-tracked.

  const now = Date.now();
  const key = getKey(guildId, userId);
  const entry = tracker.get(key) ?? { count: 0, last: now };

  // Time-based decay: if the previous message was outside the window, reset.
  if (now - entry.last > AUTOMOD.SPAM_WINDOW_MS) {
    entry.count = 0;
  }

  entry.count += 1;
  entry.last = now;
  tracker.set(key, entry);

  return entry.count > AUTOMOD.SPAM_LIMIT;
}

/**
 * Clears the in-memory spam history for a user in a guild.
 *
 * Call this after a spam violation has been punished so the user isn't
 * immediately re-flagged on their next message. (Fixes H-03.)
 */
export function clearSpamHistory(guildId: string, userId: string): void {
  tracker.delete(getKey(guildId, userId));
}
