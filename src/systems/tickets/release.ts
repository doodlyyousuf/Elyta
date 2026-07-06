import { EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export async function releaseTicket(interaction: any) {
  const channel = interaction.channel;
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    return interaction.followUp({ content: "❌ This is not an open ticket channel.", ephemeral: true });
  }
  if (!ticket.claimed_by) {
    return interaction.followUp({ content: "❌ This ticket is not claimed.", ephemeral: true });
  }
  if (ticket.claimed_by !== interaction.user.id && !interaction.member?.permissions.has("ManageChannels")) {
    return interaction.followUp({ content: "❌ Only the claimer or staff can release.", ephemeral: true });
  }

  await supabase.from("tickets").update({ claimed_by: null }).eq("id", ticket.id);
  await supabase
    .from("ticket_claims")
    .update({ released_at: new Date().toISOString() })
    .eq("ticket_id", ticket.id)
    .is("released_at", null);

  await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: true });

  const embed = new EmbedBuilder()
    .setDescription(`🔓 Ticket released by <@${interaction.user.id}>`)
    .setColor(0x00ccff);
  await channel.send({ embeds: [embed] });
  await sendTicketLog(interaction.client, interaction.guild, `🔓 **Ticket Released**\nStaff: ${interaction.user.tag}\nTicket: #${ticket.id}`);
  await interaction.followUp({ content: "✅ Ticket released.", ephemeral: true });
}
