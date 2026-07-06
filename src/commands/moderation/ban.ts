
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a member from the server")
  .addUserOption((o) => o.setName("user").setDescription("Member to ban").setRequired(true))
  .addStringOption((o) => o.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") || "No reason";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Member not found.");
  if (!member.bannable) return interaction.editReply("❌ Cannot ban this member.");
  await member.ban({ reason });
  await interaction.editReply(`✅ Banned **${user.tag}** | ${reason}`);
}
