
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unban a user from the server")
  .addStringOption((o) => o.setName("userid").setDescription("User ID to unban").setRequired(true))
  .addStringOption((o) => o.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: any) {
  const userId = interaction.options.getString("userid", true);
  const reason = interaction.options.getString("reason") || "No reason provided";
  if (!/^\d{17,20}$/.test(userId)) return interaction.editReply("❌ Invalid user ID.");
  try {
    await interaction.guild.bans.fetch(userId);
  } catch {
    return interaction.editReply("❌ That user is not banned.");
  }
  await interaction.guild.members.unban(userId, reason);
  await interaction.editReply(`✅ Unbanned <@${userId}> | ${reason}`);
}
