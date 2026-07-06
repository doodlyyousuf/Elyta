
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder().setName("ping").setDescription("Check bot latency");

export async function execute(interaction: any) {
  const sent = Date.now();
  await interaction.editReply("🏓 Pinging...");
  const latency = Date.now() - sent;
  const api = Math.round(interaction.client.ws.ping);
  await interaction.editReply(`🏓 Pong! ${latency}ms | API: ${api}ms`);
}
