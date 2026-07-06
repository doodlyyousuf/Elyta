
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { pickGiveawayWinners } from "../../systems/giveaways/giveawayHelper.js";
import {
  buildActiveGiveawayEmbed,
  buildEndedGiveawayEmbed,
  buildNoParticipantsEmbed,
  formatPrize,
} from "../../systems/giveaways/giveawayEmbeds.js";

export const data = new SlashCommandBuilder()
  .setName("giveaway-end")
  .setDescription("End a giveaway early")
  .addStringOption((o) => o.setName("message_id").setDescription("Giveaway message ID").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const messageId = interaction.options.getString("message_id", true);
  const { data: giveaway, error } = await supabase.from("giveaways").select("*").eq("message_id", messageId).single();
  if (error || !giveaway) return interaction.editReply("❌ Giveaway not found.");
  if (giveaway.ended) return interaction.editReply("❌ Already ended.");

  const prize = formatPrize(giveaway.prize);
  const channel = await interaction.client.channels.fetch(giveaway.channel_id);
  const message = await channel.messages.fetch(messageId);
  const reaction = message.reactions.cache.get("🎉");

  if (reaction) {
    const { winners, participants } = await pickGiveawayWinners(reaction, giveaway.winners);
    if (participants.size === 0) {
      await channel.send({ embeds: [buildNoParticipantsEmbed(prize)] });
    } else {
      const winnerMentions = winners.map((w: any) => w.toString()).join(", ");
      await channel.send({
        content: winners.length ? `🎊 Congratulations ${winnerMentions}!` : undefined,
        embeds: [buildEndedGiveawayEmbed({ prize, winners: giveaway.winners, winnerMentions, endedEarly: true })],
      });
    }
    await message.edit({
      embeds: [
        buildActiveGiveawayEmbed({ prize, winners: giveaway.winners, endTime: new Date(giveaway.end_time) })
          .setTitle("🎉  GIVEAWAY ENDED  🎉")
          .setColor(0x2f3136),
      ],
    });
  }

  await supabase.from("giveaways").update({ ended: true }).eq("id", giveaway.id);
  await interaction.editReply("✅ Giveaway ended!");
}
