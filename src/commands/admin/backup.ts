
import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("backup")
  .setDescription("Create a backup of server settings")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const { data: settings } = await supabase
    .from("guild_settings")
    .select("*")
    .eq("guild_id", interaction.guildId)
    .single();

  const { data: roles } = await supabase
    .from("button_roles")
    .select("*")
    .eq("guild_id", interaction.guildId);

  const { data: rewards } = await supabase
    .from("role_rewards")
    .select("*")
    .eq("guild_id", interaction.guildId);

  const backup = {
    guild_id: interaction.guildId,
    guild_name: interaction.guild.name,
    timestamp: new Date().toISOString(),
    settings,
    button_roles: roles || [],
    role_rewards: rewards || [],
  };

  const backupJson = JSON.stringify(backup, null, 2);
  const buffer = Buffer.from(backupJson, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: `backup-${interaction.guildId}-${Date.now()}.json` });

  await interaction.editReply({
    content: "✅ Backup created successfully!",
    files: [attachment],
  });
}
