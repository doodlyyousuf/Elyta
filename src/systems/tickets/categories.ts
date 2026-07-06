import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

export const TICKET_CATEGORIES = [
  { id: "support", label: "Support", emoji: "🆘" },
  { id: "report", label: "Report", emoji: "📢" },
  { id: "order", label: "Order", emoji: "📦" },
  { id: "builder", label: "Builder", emoji: "🔨" },
];

export function getCategoryEmoji(category: string): string {
  return TICKET_CATEGORIES.find((c) => c.id === category)?.emoji || "🎫";
}

export function getCategoryFromCustomId(customId: string): string | null {
  if (!customId.startsWith("category_")) return null;
  const cat = customId.replace("category_", "");
  return TICKET_CATEGORIES.some((c) => c.id === cat) ? cat : null;
}

export function getCategoryButtons() {
  const buttons = TICKET_CATEGORIES.map((cat) =>
    new ButtonBuilder()
      .setCustomId(`category_${cat.id}`)
      .setLabel(cat.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(cat.emoji)
  );
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}
