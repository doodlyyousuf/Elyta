
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("restore")
  .setDescription("Restore server settings from backup")
  .addAttachmentOption((o) => o.setName("backup").setDescription("Backup JSON file").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const attachment = interaction.options.getAttachment("backup", true);
  
  if (!attachment.name.endsWith(".json")) {
    return interaction.editReply("❌ Please upload a JSON backup file.");
  }

  try {
    const response = await fetch(attachment.url);
    const backup = await response.json();

    if (backup.guild_id !== interaction.guildId) {
      return interaction.editReply("❌ This backup is from a different server.");
    }

    // Restore settings
    if (backup.settings) {
      await supabase.from("guild_settings").upsert(backup.settings);
    }

    // Restore button roles
    if (backup.button_roles && backup.button_roles.length > 0) {
      for (const role of backup.button_roles) {
        await supabase.from("button_roles").upsert(role);
      }
    }

    // Restore role rewards
    if (backup.role_rewards && backup.role_rewards.length > 0) {
      for (const reward of backup.role_rewards) {
        await supabase.from("role_rewards").upsert(reward);
      }
    }

    await interaction.editReply(`✅ Backup restored successfully! (From ${new Date(backup.timestamp).toLocaleString()})`);
  } catch (error) {
    console.error("Restore error:", error);
    await interaction.editReply("❌ Failed to restore backup. Invalid or corrupted file.");
  }
}
