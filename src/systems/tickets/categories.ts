
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";

export const TICKET_CATEGORIES = [
  { id: "support", label: "Support", emoji: "🆘" },
  { id: "report", label: "Report", emoji: "📢" },
  { id: "order", label: "Order", emoji: "📦" },
  { id: "builder", label: "Builder", emoji: "🔨" },
] as const;

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

// ── L-07: Centralised customId helpers ───────────────────────────────────────
// The old `ticket_priority_` prefix was overloaded: it was used both for the
// category→priority select menu AND parsed back out as the chosen priority
// result. The orchestrator's interactionCreate now uses DISTINCT prefixes:
//   • `ticket_priority_select_${category}` — the select menu shown after a
//     category button is clicked (handled below).
//   • `priority_select_${ticketId}`         — the in-ticket "change priority"
//     menu (already distinct in the orchestrator).
// Centralising the construction/parsing here keeps the two sides in sync.

const PRIORITY_SELECT_PREFIX = "ticket_priority_select_";

/**
 * Build the customId for the category→priority select menu shown after the
 * user clicks a category button.
 */
export function prioritySelectCustomId(category: string): string {
  return `${PRIORITY_SELECT_PREFIX}${category}`;
}

/**
 * Inverse of `prioritySelectCustomId`. Returns the category slug when the
 * customId matches the priority-select prefix and corresponds to a known
 * category, otherwise `null`.
 */
export function parsePrioritySelectCategory(customId: string): string | null {
  if (!customId.startsWith(PRIORITY_SELECT_PREFIX)) return null;
  const cat = customId.slice(PRIORITY_SELECT_PREFIX.length);
  return TICKET_CATEGORIES.some((c) => c.id === cat) ? cat : null;
}
