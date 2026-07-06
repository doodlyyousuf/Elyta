
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { commands } from "../../handlers/loadCommands.js";

const CATEGORY_HINTS: Record<string, string> = {
  ban: "Moderation", kick: "Moderation", timeout: "Moderation", warn: "Moderation",
  warnings: "Moderation", purge: "Moderation", slowmode: "Moderation", nickname: "Moderation", unban: "Moderation",
  ticket: "Tickets", "ticket-reopen": "Tickets", ticketpanel: "Tickets",
  "giveaway-create": "Giveaways", "giveaway-end": "Giveaways", "giveaway-reroll": "Giveaways",
  order: "SMP Builder", "order-status": "SMP Builder", builder: "SMP Builder",
  autorole: "Roles", buttonrole: "Roles",
  ping: "Utility", userinfo: "Utility", serverinfo: "Utility", avatar: "Utility",
  poll: "Utility", invites: "Utility", help: "Utility",
};

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("List all available bot commands")
  .addStringOption((o) =>
    o.setName("category").setDescription("Filter by category").setRequired(false).addChoices(
      { name: "Moderation", value: "Moderation" },
      { name: "Tickets", value: "Tickets" },
      { name: "Giveaways", value: "Giveaways" },
      { name: "SMP Builder", value: "SMP Builder" },
      { name: "Roles", value: "Roles" },
      { name: "Utility", value: "Utility" }
    )
  );

export async function execute(interaction: any) {
  const filter = interaction.options.getString("category");
  const grouped = new Map<string, string[]>();
  for (const cmd of commands.values()) {
    const name = cmd.data.name;
    const category = CATEGORY_HINTS[name] || "Other";
    if (filter && category !== filter) continue;
    const line = `\`/${name}\` — ${cmd.data.description}`;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(line);
  }
  if (!grouped.size) return interaction.editReply("No commands found for that category.");
  const embed = new EmbedBuilder()
    .setTitle("📖 Bot Commands")
    .setColor(0x5865f2)
    .setFooter({ text: `${commands.size} commands available` })
    .setTimestamp();
  for (const [category, lines] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    embed.addFields({ name: category, value: lines.sort().join("\n").slice(0, 1024) });
  }
  await interaction.editReply({ embeds: [embed] });
}
