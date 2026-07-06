
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getBuilderStats } from "../../systems/smp/builderRatings.js";
import { getBuilderEarnings } from "../../systems/smp/earningsTracker.js";

export const data = new SlashCommandBuilder()
  .setName("builderstats")
  .setDescription("View builder statistics")
  .addUserOption((o) => o.setName("builder").setDescription("Builder to check"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: any) {
  const targetUser = interaction.options.getUser("builder") || interaction.user;
  const ratings = await getBuilderStats(interaction.guildId, targetUser.id);
  const earnings = await getBuilderEarnings(interaction.guildId, targetUser.id);

  const embed = new EmbedBuilder()
    .setTitle(`📊 Builder Stats - ${targetUser.tag}`)
    .addFields(
      { name: "Average Rating", value: `${ratings.averageRating}⭐`, inline: true },
      { name: "Total Ratings", value: ratings.totalRatings.toString(), inline: true },
      { name: "Completed Orders", value: ratings.totalOrders.toString(), inline: true },
      { name: "Total Earnings", value: `$${earnings.totalEarnings.toLocaleString()}`, inline: true },
      { name: "Paid Orders", value: earnings.orderCount.toString(), inline: true }
    )
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
