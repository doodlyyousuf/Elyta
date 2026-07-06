
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("autopublish")
    .setDescription("Enable or disable auto-publish for announcement channels")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Announcement channel")
        .addChannelTypes(ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName("enabled")
        .setDescription("Enable or disable auto-publish")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: any) {
    const channel = interaction.options.getChannel("channel");
    const enabled = interaction.options.getBoolean("enabled");

    try {
      if (enabled) {
        await channel.setAutoArchiveDuration(60); // Set to 1 hour
        await interaction.editReply(`✅ Auto-publish enabled for ${channel}`);
      } else {
        await channel.setAutoArchiveDuration(1440); // Set to 24 hours (effectively disable)
        await interaction.editReply(`✅ Auto-publish disabled for ${channel}`);
      }
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to update auto-publish settings.",
      });
    }
  },
};
