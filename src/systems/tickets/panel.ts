import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

export function buildTicketPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("🎫 Support Tickets")
    .setDescription("Click **Create Ticket** below, then choose a category.\n\n🆘 Support — General help\n📢 Report — Bugs & abuse\n📦 Order — Purchases\n🔨 Builder — SMP builds")
    .setColor(0x5865f2)
    .setFooter({ text: "Our team will respond as soon as possible" });
}

export function buildTicketPanelButtons() {
  const btn = new ButtonBuilder()
    .setCustomId("ticket_create")
    .setLabel("Create Ticket")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🎫");
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)];
}
