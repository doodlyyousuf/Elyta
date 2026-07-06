
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { getCategoryEmoji } from "../../systems/tickets/categories.js";
import { sendTicketLog } from "../../systems/tickets/logs.js";

export const data = new SlashCommandBuilder()
  .setName("ticket-priority")
  .setDescription("Adjust the priority of a ticket")
  .addStringOption((o) =>
    o
      .setName("level")
      .setDescription("Priority level")
      .setRequired(true)
      .addChoices(
        { name: "Low 🟢", value: "low" },
        { name: "Medium 🟡", value: "medium" },
        { name: "High 🔴", value: "high" }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: any) {
  const priority = interaction.options.getString("level", true);
  const channel = interaction.channel;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    return interaction.editReply("❌ This is not an open ticket channel.");
  }

  await supabase.from("tickets").update({ priority }).eq("id", ticket.id);

  const user = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
  const username = user ? user.username : ticket.user_id;

  const categoryEmoji = getCategoryEmoji(ticket.category || "support");
  const priorityEmoji = priority === "high" ? "🔴" : priority === "low" ? "🟢" : "🟡";
  const newName = `${priorityEmoji}-${categoryEmoji}-ticket-${username}`;

  await channel.setName(newName).catch(() => {});

  const embed = new EmbedBuilder()
    .setDescription(`🚦 Ticket priority updated to **${priority.charAt(0).toUpperCase() + priority.slice(1)}** by <@${interaction.user.id}>`)
    .setColor(priority === "high" ? 0xff0000 : priority === "low" ? 0x00ff00 : 0xffff00);

  await channel.send({ embeds: [embed] });
  await sendTicketLog(
    interaction.client,
    interaction.guild,
    `🚦 **Priority Updated**\nTicket: #${ticket.id}\nNew Priority: ${priorityEmoji} ${priority}\nUpdated By: <@${interaction.user.id}>`
  );

  await interaction.editReply(`✅ Priority updated to ${priority}.`);
}
