
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("reactionrole")
  .setDescription("Create a reaction role")
  .addRoleOption((o) => o.setName("role").setDescription("Role to assign").setRequired(true))
  .addStringOption((o) => o.setName("emoji").setDescription("Emoji reaction").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const role = interaction.options.getRole("role", true);
  const emoji = interaction.options.getString("emoji", true);

  await supabase.from("reaction_roles").upsert({
    guild_id: interaction.guildId,
    channel_id: interaction.channelId,
    role_id: role.id,
    emoji,
  });

  await interaction.editReply(`✅ Reaction role set! React with ${emoji} to get **${role.name}**.`);
}
