
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create a quick poll")
  .addStringOption((o) => o.setName("question").setDescription("Poll question").setRequired(true));

export async function execute(interaction: any) {
  const question = interaction.options.getString("question", true);
  const msg = await interaction.channel.send(`📊 **Poll:** ${question}`);
  await msg.react("👍");
  await msg.react("👎");
  await interaction.editReply("✅ Poll created!");
}
