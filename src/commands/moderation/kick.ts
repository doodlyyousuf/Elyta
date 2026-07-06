
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member from the server")
  .addUserOption((o) => o.setName("user").setDescription("Member to kick").setRequired(true))
  .addStringOption((o) => o.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") || "No reason";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Member not found.");
  if (!member.kickable) return interaction.editReply("❌ Cannot kick this member.");
  await member.kick(reason);
  await interaction.editReply(`✅ Kicked **${user.tag}** | ${reason}`);
}
