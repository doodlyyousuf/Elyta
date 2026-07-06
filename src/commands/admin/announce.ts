
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to a channel")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to send announcement to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("title")
        .setDescription("Announcement title")
    )
    .addBooleanOption(option =>
      option
        .setName("ping")
        .setDescription("Ping @everyone")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any) {
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    const title = interaction.options.getString("title");
    const ping = interaction.options.getBoolean("ping");

    try {
      const content = ping ? "@everyone " : "";
      
      if (title) {
        const embed = {
          color: 0x5865F2,
          title: `📢 ${title}`,
          description: message,
          timestamp: new Date().toISOString(),
        };
        await channel.send({ content, embeds: [embed] });
      } else {
        await channel.send(content + message);
      }

      await interaction.editReply(`✅ Announcement sent to ${channel}`);
    } catch (error) {
      await interaction.editReply("❌ Failed to send announcement.");
    }
  },
};
