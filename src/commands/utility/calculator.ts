
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("calculator")
    .setDescription("Perform mathematical calculations")
    .addStringOption(option =>
      option
        .setName("expression")
        .setDescription("Mathematical expression to calculate (e.g., 2+2, 10*5)")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const expression = interaction.options.getString("expression");

    try {
      // Only allow safe mathematical operations
      const sanitized = expression
        .replace(/[^0-9+\-*/().%^]/g, "");

      if (!sanitized) {
        return interaction.editReply({
          content: "❌ Invalid expression. Only numbers and operators (+, -, *, /, %, ^) are allowed.",
        });
      }

      // Use Function constructor for safe evaluation
      const result = new Function(`return ${sanitized}`)();

      if (!isFinite(result) || isNaN(result)) {
        return interaction.editReply({
          content: "❌ Invalid calculation result.",
        });
      }

      const embed = {
        color: 0x5865F2,
        title: "🧮 Calculator",
        fields: [
          { name: "Expression", value: expression, inline: true },
          { name: "Result", value: result.toString(), inline: true },
        ],
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        content: "❌ Invalid expression. Please check your input.",
      });
    }
  },
};
