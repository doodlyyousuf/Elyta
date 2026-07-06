
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("nickname")
  .setDescription("Change a member's nickname")
  .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
  .addStringOption((o) => o.setName("name").setDescription("New nickname (empty to reset)").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const name = interaction.options.getString("name", true);
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Member not found.");
  await member.setNickname(name || null);
  await interaction.editReply(`✅ Nickname updated for **${user.tag}**.`);
}
