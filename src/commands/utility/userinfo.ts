
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Get info about a user")
  .addUserOption((o) => o.setName("user").setDescription("User"));

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user") || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const embed = new EmbedBuilder()
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "ID", value: user.id, inline: true },
      { name: "Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Joined", value: member ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : "N/A", inline: true }
    )
    .setColor(0x5865f2);
  await interaction.editReply({ embeds: [embed] });
}
