
import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import QRCode from "qrcode";

export default {
  data: new SlashCommandBuilder()
    .setName("qr")
    .setDescription("Generate a QR code from text or URL")
    .addStringOption(option =>
      option
        .setName("text")
        .setDescription("Text or URL to convert to QR code")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const text = interaction.options.getString("text");

    try {
      const qrBuffer = await QRCode.toBuffer(text, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      const attachment = new AttachmentBuilder(qrBuffer, {
        name: "qrcode.png",
      });

      await interaction.editReply({
        content: `📱 QR Code for: ${text}`,
        files: [attachment],
      });
    } catch (error) {
      await interaction.editReply("❌ Failed to generate QR code.");
    }
  },
};
