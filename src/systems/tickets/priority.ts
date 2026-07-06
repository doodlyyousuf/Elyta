
import { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export function buildPrioritySelectMenu(ticketId: number) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`priority_select_${ticketId}`)
    .setPlaceholder("Select new priority")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("🔴 High Priority")
        .setValue("high")
        .setDescription("Urgent - needs immediate attention"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🟡 Medium Priority")
        .setValue("medium")
        .setDescription("Normal - standard response time"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🟢 Low Priority")
        .setValue("low")
        .setDescription("Non-urgent - can wait")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function updateTicketPriority(interaction: any, ticketId: number, newPriority: string) {
  const channel = interaction.channel;
  const guild = interaction.guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return interaction.update({ content: "❌ Ticket not found.", components: [] });
  }

  const oldPriority = ticket.priority || "medium";
  await supabase.from("tickets").update({ priority: newPriority }).eq("id", ticketId);

  const priorityEmoji = newPriority === "high" ? "🔴" : newPriority === "low" ? "🟢" : "🟡";
  const embed = new EmbedBuilder()
    .setDescription(`🔄 Priority changed from ${oldPriority} to ${newPriority} ${priorityEmoji}`)
    .setColor(newPriority === "high" ? 0xff0000 : newPriority === "low" ? 0x00ff00 : 0xffff00)
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  await sendTicketLog(
    interaction.client,
    guild,
    `🔄 **Priority Changed**\nTicket: #${ticketId}\nFrom: ${oldPriority}\nTo: ${newPriority}\nChanged by: ${interaction.user.tag}`
  );

  await interaction.update({ content: `✅ Priority updated to ${newPriority}.`, components: [] });
}
