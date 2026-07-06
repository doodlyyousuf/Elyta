
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock a channel to allow messages")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The channel to unlock (defaults to current)")
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Reason for unlocking")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: any) {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const reason = interaction.options.getString("reason") || "No reason provided";

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      });

      await interaction.editReply({
        content: `🔓 ${channel} has been unlocked.\n**Reason:** ${reason}`,
      });
    } catch (error) {
      await interaction.editReply({
        content: "❌ Failed to unlock the channel.",
      });
    }
  },
};
