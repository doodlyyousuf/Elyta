
import { EmbedBuilder, PermissionsBitField, MessageFlags } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export async function transferTicket(interaction: any, targetUser: any) {
  const channel = interaction.channel;
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    return interaction.editReply({ content: "❌ This is not an open ticket channel." });
  }

  if (!ticket.claimed_by) {
    return interaction.editReply({ content: "❌ This ticket must be claimed before transferring." });
  }

  if (ticket.claimed_by !== interaction.user.id) {
    return interaction.editReply({ content: "❌ You can only transfer tickets you have claimed." });
  }

  // Update ticket ownership
  await supabase.from("tickets").update({ claimed_by: targetUser.id }).eq("id", ticket.id);
  await supabase.from("ticket_transfers").insert({
    ticket_id: ticket.id,
    from_staff_id: interaction.user.id,
    to_staff_id: targetUser.id,
  });

  // Update permissions
  await channel.permissionOverwrites.edit(targetUser.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  const embed = new EmbedBuilder()
    .setDescription(`🔄 Ticket transferred from <@${interaction.user.id}> to <@${targetUser.id}>`)
    .setColor(0x00ff00)
    .setTimestamp();
  await channel.send({ embeds: [embed] });

  await sendTicketLog(
    interaction.client,
    interaction.guild,
    `🔄 **Ticket Transferred**\nFrom: ${interaction.user.tag}\nTo: ${targetUser.tag}\nTicket: #${ticket.id}`
  );

  await interaction.editReply({ content: `✅ Ticket transferred to ${targetUser.tag}.` });
}
