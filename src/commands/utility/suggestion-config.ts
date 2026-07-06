
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("suggestion-config")
  .setDescription("Set the channel for suggestions")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("The channel where suggestions will be posted")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction: any) {
  const channel = interaction.options.getChannel("channel", true);

  const { error } = await supabase
    .from("guild_settings")
    .upsert(
      { guild_id: interaction.guildId, suggestion_channel_id: channel.id },
      { onConflict: "guild_id" }
    );

  if (error) {
    console.error("Failed to update suggestion settings:", error);
    return interaction.editReply("❌ Failed to save suggestion settings. Please try again.");
  }

  await interaction.editReply(`✅ Suggestion channel set to ${channel}. Members can now use \`/suggest\` to submit ideas.`);
}
