import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";

export async function sendTicketLog(
  _client: any,
  guild: any,
  text: string,
  components?: ActionRowBuilder<ButtonBuilder>[]
) {
  let logChannel = guild.channels.cache.find((c: any) => c.name === "ticket-logs");
  if (!logChannel) {
    logChannel = await guild.channels.create({ name: "ticket-logs", topic: "Ticket logs" });
  }
  const embed = new EmbedBuilder()
    .setTitle("🎫 Ticket Log")
    .setDescription(text)
    .setColor(0xffcc00)
    .setTimestamp();
  await logChannel.send({ embeds: [embed], components: components || [] });
}
