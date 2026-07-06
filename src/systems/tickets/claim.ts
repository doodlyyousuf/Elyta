import { EmbedBuilder, PermissionsBitField } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export async function claimTicket(interaction: any) {
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
  if (ticket.claimed_by) {
    return interaction.followUp({ content: `❌ Already claimed by <@${ticket.claimed_by}>.`, ephemeral: true });
  }

  await supabase.from("tickets").update({ claimed_by: interaction.user.id }).eq("id", ticket.id);
  await supabase.from("ticket_claims").insert({ ticket_id: ticket.id, staff_id: interaction.user.id });

  const userOverwrite = channel.permissionOverwrites.cache.get(ticket.user_id);
  if (userOverwrite) {
    await channel.permissionOverwrites.edit(ticket.user_id, { SendMessages: false });
  }

  const embed = new EmbedBuilder()
    .setDescription(`🔒 Ticket claimed by <@${interaction.user.id}>`)
    .setColor(0xffaa00);
  await channel.send({ embeds: [embed] });
  await sendTicketLog(interaction.client, interaction.guild, `👤 **Ticket Claimed**\nStaff: ${interaction.user.tag}\nTicket: #${ticket.id}`);
  await interaction.followUp({ content: "✅ You claimed this ticket.", ephemeral: true });
}
