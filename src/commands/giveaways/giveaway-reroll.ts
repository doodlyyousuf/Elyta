
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { pickGiveawayWinners } from "../../systems/giveaways/giveawayHelper.js";
import { buildRerollGiveawayEmbed, formatPrize } from "../../systems/giveaways/giveawayEmbeds.js";
import { logGiveawayRerolled } from "../../systems/giveaways/giveawayLogs.js";

export const data = new SlashCommandBuilder()
  .setName("giveaway-reroll")
  .setDescription("Reroll giveaway winners")
  .addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const messageId = interaction.options.getString("message_id", true);
  const { data: giveaway, error } = await supabase.from("giveaways").select("*").eq("message_id", messageId).single();
  if (error || !giveaway) return interaction.editReply("❌ Giveaway not found.");

  const prize = formatPrize(giveaway.prize);
  const channel = await interaction.client.channels.fetch(giveaway.channel_id);
  const message = await channel.messages.fetch(messageId);
  const reaction = message.reactions.cache.get("🎉");
  if (!reaction) return interaction.editReply("❌ No reactions found.");

  const { winners, participants } = await pickGiveawayWinners(reaction, giveaway.winners);
  if (participants.size === 0) return interaction.editReply("❌ No participants.");

  const winnerMentions = winners.map((w: any) => w.toString()).join(", ");
  await channel.send({
    content: winners.length ? `🎊 New winner(s): ${winnerMentions}!` : undefined,
    embeds: [buildRerollGiveawayEmbed({ prize, winnerMentions })],
  });
  await logGiveawayRerolled(interaction.guild, prize, winnerMentions.split(", "));
  await interaction.editReply("✅ Winners rerolled!");
}
