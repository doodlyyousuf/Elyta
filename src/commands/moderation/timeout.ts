
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../systems/logging/logHelper.js";

export const data = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a member")
  .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
  .addIntegerOption((o) => o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
  .addStringOption((o) => o.setName("reason").setDescription("Reason"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const reason = interaction.options.getString("reason") || "No reason";
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply("❌ Member not found.");
  if (!member.moderatable) return interaction.editReply("❌ Cannot timeout this member.");
  await member.timeout(minutes * 60 * 1000, reason);
  
  await sendModLog(
    interaction.guild,
    "⏰ Member Timed Out",
    `**Target:** ${user.tag} (${user.id})\n**Moderator:** ${interaction.user.tag}\n**Duration:** ${minutes} minutes\n**Reason:** ${reason}`,
    0xff9900
  );
  
  await interaction.editReply(`✅ Timed out **${user.tag}** for ${minutes}m | ${reason}`);
}
