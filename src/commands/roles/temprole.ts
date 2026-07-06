
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("temprole")
  .setDescription("Assign a temporary role to a member")
  .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
  .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
  .addIntegerOption((o) => o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(43200))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: any) {
  const user = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true);
  const minutes = interaction.options.getInteger("minutes", true);
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  if (!member) return interaction.editReply("❌ Member not found.");

  await member.roles.add(role);

  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  await supabase.from("temporary_roles").insert({
    guild_id: interaction.guildId,
    user_id: user.id,
    role_id: role.id,
    expires_at: expiresAt.toISOString(),
  });

  await interaction.editReply(`✅ Gave **${role.name}** to ${user.tag} for ${minutes} minutes.`);
}
