/**
 * /warn — Warn a member.
 *
 * Fixes H-14: previously the command inserted a row and replied success even
 * if the insert failed (no try/catch). It also never DM'd the user, never
 * incremented a counter, and never triggered auto-escalation. Now:
 *   1. Wraps the DB insert in try/catch via the `addWarning` helper, replying
 *      with the failure (ephemeral-style via editReply) on error instead of
 *      success.
 *   2. DMs the warned user the reason (ignoring DM failures).
 *   3. Links manual warns to the AutoMod violation counter via
 *      `recordViolation` so the count accumulates. We intentionally do NOT
 *      call `applyAutoPunishment` here (it expects a Message object we don't
 *      have) — only the violation count is recorded, and the moderator is
 *      informed of the new total in the reply.
 *   4. Keeps the `data` SlashCommandBuilder and accepts an optional `client?`
 *      argument (ignored) for orchestration compatibility. Replies use
 *      `interaction.editReply` (interactionCreate always defers), with a
 *      fallback to `reply` if the interaction isn't deferred yet.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Client,
  Guild,
  User,
} from "discord.js";
import { recordViolation } from "../../systems/automod/punishments.js";
import { addWarning } from "../../systems/moderation/warnings.js";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Warn a member")
  .addUserOption((o) =>
    o.setName("user").setDescription("Member").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("reason").setDescription("Reason").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

async function reply(
  interaction: ChatInputCommandInteraction,
  content: string,
  ephemeral = false
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(content).catch(() => {});
  } else {
    await interaction
      .reply({ content, ephemeral })
      .catch(() => {});
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  _client?: Client
): Promise<void> {
  const user: User = interaction.options.getUser("user", true);
  const reason: string = interaction.options.getString("reason", true);
  const guild: Guild | null = interaction.guild;
  const guildId: string = guild?.id ?? interaction.guildId ?? "";

  // 1. Insert the warning row (try/catch — no more false-success on error).
  try {
    await addWarning(guildId, user.id, interaction.user.id, reason);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await reply(
      interaction,
      `❌ Failed to warn **${user.tag}**: ${msg}`,
      true
    );
    return;
  }

  // 2. DM the warned user the reason (ignore DM failures).
  await user
    .send({
      content: `⚠️ You have been warned in **${guild?.name ?? "Unknown Server"}** for: ${reason}`,
    })
    .catch(() => {});

  // 3. Link manual warns to the AutoMod violation counter (accumulate only).
  const violations = recordViolation(guildId, user.id);

  // 4. Inform the moderator of the warn + new violation count.
  await reply(
    interaction,
    `⚠️ Warned **${user.tag}** | ${reason}\n📊 Total violations: **${violations}**`
  );
}
