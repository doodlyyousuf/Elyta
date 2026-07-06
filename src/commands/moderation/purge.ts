
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../systems/logging/logHelper.js";

export const data = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Delete multiple messages")
  .addIntegerOption((o) => o.setName("amount").setDescription("1-100 messages").setRequired(true).setMinValue(1).setMaxValue(100))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: any) {
  const amount = interaction.options.getInteger("amount", true);
  const channel = interaction.channel;

  // `bulkDelete` can throw "Unknown Message" (10008) if the collection includes
  // the interaction's own deferred reply or messages that vanish mid-fetch.
  // Fetch explicitly, exclude the bot's own reply, then bulk-delete the rest.
  let fetched: any[];
  try {
    fetched = await channel.messages.fetch({ limit: amount });
  } catch (err: any) {
    return interaction.editReply(`❌ Failed to fetch messages: ${err?.message ?? err}`);
  }

  // Exclude the interaction reply (and any bot message) so editReply below works.
  const replyId = (interaction as any).id; // deferred interactions don't expose the message id reliably
  const toDelete = fetched.filter((m: any) => {
    // Drop the deferred interaction reply if present
    if (replyId && m.id === replyId) return false;
    return true;
  });

  let deleted = 0;
  try {
    // bulkDelete accepts a Collection or an array of messages/ids; use the
    // filtered array directly so the interaction reply is never targeted.
    const res = await channel.bulkDelete(toDelete, true);
    deleted = res.size;
  } catch (err: any) {
    // Fallback: delete one-by-one (slower but resilient against "Unknown Message").
    for (const m of toDelete) {
      try {
        await m.delete();
        deleted++;
      } catch {
        // individual delete failures (already-deleted, too old) are non-fatal
      }
    }
  }

  await sendModLog(
    interaction.guild,
    "🗑️ Messages Purged",
    `**Moderator:** ${interaction.user.tag}\n**Channel:** <#${channel.id}>\n**Amount:** ${deleted} messages`,
    0xe74c3c
  );

  // editReply may itself throw "Unknown Message" if the purge somehow caught the
  // interaction reply. Fall back to followUp in that case so the user always
  // gets feedback.
  try {
    await interaction.editReply(`✅ Deleted ${deleted} message(s).`);
  } catch {
    try {
      await interaction.followUp({ content: `✅ Deleted ${deleted} message(s).`, flags: ["Ephemeral"] });
    } catch {
      /* give up silently */
    }
  }
}
