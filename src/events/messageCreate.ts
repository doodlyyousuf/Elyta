/**
 * messageCreate event — AutoMod pipeline.
 *
 * Fix H-07 (HIGH, Security): the previous implementation ran
 * `if (message.member?.permissions.has("ManageMessages")) return;` BEFORE
 * every filter, so moderators bypassed anti-scam / anti-invite / anti-link
 * entirely. A compromised mod account could freely post scam/invite links.
 *
 * Now the ManageMessages exemption guards ONLY the low-severity filters
 * (spam, caps, emoji). The high-severity filters — anti-invite, anti-link,
 * anti-mention, anti-scam, bad-words — ALWAYS run, even for mods.
 *
 * Other fixes:
 *  - `message` is typed as `Message` from discord.js (no more `any`).
 *  - Uses `isSpamming` from the canonical in-memory `antiSpam.ts`
 *    (NOT the DB-backed `antispam/antispam.ts`).
 *  - After a spam violation is punished, calls the new
 *    `clearSpamHistory(guildId, userId)` so the user's in-memory spam
 *    counter is reset (H-03 in antiSpam.ts). The violation count itself is
 *    handled by `punishments.ts` (`applyAutoPunishment` resets on kick).
 */

import type { Message } from "discord.js";
import { isSpamming, clearSpamHistory } from "../systems/automod/antiSpam.js";
import { containsInvite, containsLink } from "../systems/automod/antiLink.js";
import { isMentionSpam } from "../systems/automod/antiMention.js";
import { isExcessiveCaps } from "../systems/automod/antiCaps.js";
import { isEmojiSpam } from "../systems/automod/antiEmoji.js";
import { isScamMessage } from "../systems/automod/antiScam.js";
import { containsBadWord } from "../systems/automod/badWords.js";
import { recordViolation, applyAutoPunishment } from "../systems/automod/punishments.js";
import { containsInvite as checkInvite } from "../systems/automod/antiInvite.js";

async function handleViolation(message: Message, reason: string): Promise<void> {
  await message.delete().catch(() => {});
  const guildId = message.guild?.id;
  if (!guildId) return;
  const count = recordViolation(guildId, message.author.id);
  const punishment = await applyAutoPunishment(message, reason, count);

  let notice = `${message.author}, ${reason}.`;
  if (punishment === "warned") notice += " ⚠️ Auto-warned.";
  else if (punishment === "muted") notice += " 🔇 Auto-muted for 10 minutes.";
  else if (punishment === "kicked") notice += " 👢 Auto-kicked.";

  await message.channel
    .send(notice)
    .then((m: Message) =>
      setTimeout(() => m.delete().catch(() => {}), 5000)
    )
    .catch(() => {});
}

export default {
  name: "messageCreate",
  async execute(message: Message): Promise<void> {
    // Ignore bots and DMs — AutoMod only runs in guilds.
    if (message.author.bot || !message.guild) return;

    // H-07: ManageMessages exempts a user ONLY from the low-severity filters.
    // High-severity filters always run.
    const exemptFromLowSeverity =
      message.member?.permissions.has("ManageMessages") ?? false;

    // ── HIGH-SEVERITY (always run, even for mods) ─────────────────────────
    if (checkInvite(message.content)) {
      return handleViolation(message, "posting invites is not allowed");
    }
    if (containsLink(message.content)) {
      return handleViolation(message, "links are not allowed");
    }
    if (isMentionSpam(message.content, message.mentions.users.size)) {
      return handleViolation(message, "excessive mentions are not allowed");
    }
    if (isScamMessage(message.content)) {
      return handleViolation(message, "potential scam detected");
    }
    if (await containsBadWord(message.content, message.guild.id)) {
      return handleViolation(message, "inappropriate language is not allowed");
    }

    // ── LOW-SEVERITY (mods exempt) ────────────────────────────────────────
    if (exemptFromLowSeverity) return;

    if (isSpamming(message.author.id, message)) {
      await handleViolation(message, "please do not spam");
      // H-03: clear the in-memory spam counter so the user's next message
      // isn't still above the threshold.
      clearSpamHistory(message.guild.id, message.author.id);
      return;
    }
    if (isExcessiveCaps(message.content)) {
      return handleViolation(message, "excessive caps are not allowed");
    }
    if (isEmojiSpam(message.content)) {
      return handleViolation(message, "excessive emoji usage is not allowed");
    }
  },
};
