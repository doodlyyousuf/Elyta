
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("autorole")
  .setDescription("Set the role given to new members")
  .addRoleOption((o) => o.setName("role").setDescription("Role to assign").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const role = interaction.options.getRole("role", true);
  await supabase.from("guild_settings").upsert({ guild_id: interaction.guildId, auto_role: role.id });
  await interaction.editReply(`✅ Autorole set to **${role.name}**.`);
}
