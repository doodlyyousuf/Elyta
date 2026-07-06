
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder().setName("serverinfo").setDescription("Get server information");

export async function execute(interaction: any) {
  const g = interaction.guild;
  const embed = new EmbedBuilder()
    .setTitle(g.name)
    .setThumbnail(g.iconURL())
    .addFields(
      { name: "Owner", value: `<@${g.ownerId}>`, inline: true },
      { name: "Members", value: `${g.memberCount}`, inline: true },
      { name: "Channels", value: `${g.channels.cache.size}`, inline: true },
      { name: "Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setColor(0x5865f2);
  await interaction.editReply({ embeds: [embed] });
}
