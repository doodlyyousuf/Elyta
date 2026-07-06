import { EmbedBuilder, MessageFlags } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export async function deleteTicket(interaction: any) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const channel = interaction.channel;
  const guild = interaction.guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .single();

  if (!ticket) {
    return interaction.editReply({ content: "❌ This is not a ticket channel." });
  }

  if (ticket.status === "open") {
    return interaction.editReply({ content: "❌ Cannot delete an open ticket. Close it first." });
  }

  await interaction.editReply({ content: "🗑️ Deleting ticket channel..." });

  // Update ticket status to deleted
  await supabase.from("tickets").update({ status: "deleted" }).eq("id", ticket.id);

  await sendTicketLog(
    interaction.client,
    guild,
    `🗑️ **Ticket Deleted**\nTicket: #${ticket.id}\nDeleted by: ${interaction.user.tag}`
  );

  const embed = new EmbedBuilder()
    .setDescription("🗑️ This channel will be deleted in 3 seconds...")
    .setColor(0xff0000);
  await channel.send({ embeds: [embed] });

  setTimeout(() => channel.delete().catch(() => {}), 3000);
}
