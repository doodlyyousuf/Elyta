
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("rolereward")
  .setDescription("Set a role reward for reaching an invite milestone")
  .addRoleOption((o) => o.setName("role").setDescription("Reward role").setRequired(true))
  .addIntegerOption((o) => o.setName("invites").setDescription("Required invites").setRequired(true).setMinValue(1))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const role = interaction.options.getRole("role", true);
  const invites = interaction.options.getInteger("invites", true);

  await supabase.from("role_rewards").upsert({
    guild_id: interaction.guildId,
    role_id: role.id,
    required_invites: invites,
  });

  await interaction.editReply(`✅ Role reward set: **${role.name}** for ${invites} invites.`);
}
