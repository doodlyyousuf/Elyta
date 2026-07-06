
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock a channel to prevent messages")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The channel to lock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for locking")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: any) {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });

      await interaction.editReply({
        content: `🔒 ${channel} has been locked.\n**Reason:** ${reason}`,
      });
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to lock the channel.",
      });
    }
  },
};
