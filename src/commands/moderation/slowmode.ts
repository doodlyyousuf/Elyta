
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../systems/logging/logHelper.js";

export const data = new SlashCommandBuilder()
  .setName("slowmode")
  .setDescription("Set channel slowmode")
  .addIntegerOption((o) => o.setName("seconds").setDescription("0 to disable").setRequired(true).setMinValue(0).setMaxValue(21600))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  const seconds = interaction.options.getInteger("seconds", true);
  await interaction.channel.setRateLimitPerUser(seconds);
  
  await sendModLog(
    interaction.guild,
    "⏱️ Slowmode Changed",
    `**Moderator:** ${interaction.user.tag}\n**Channel:** <#${interaction.channel.id}>\n**New Slowmode:** ${seconds}s`,
    0x3498db
  );
  
  await interaction.editReply(seconds ? `✅ Slowmode set to ${seconds}s.` : "✅ Slowmode disabled.");
}
