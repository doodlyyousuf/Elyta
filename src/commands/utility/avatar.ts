
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Show a user's avatar")
  .addUserOption((o) => o.setName("user").setDescription("User"));

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user") || interaction.user;
  const embed = new EmbedBuilder()
    .setTitle(`${user.tag}'s Avatar`)
    .setImage(user.displayAvatarURL({ size: 1024 }))
    .setColor(0x5865f2);
  await interaction.editReply({ embeds: [embed] });
}
