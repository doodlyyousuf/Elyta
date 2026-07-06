
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "../../systems/tickets/logs.js";

export const data = new SlashCommandBuilder()
  .setName("ticket-transfer")
  .setDescription("Transfer a claimed ticket to another staff member")
  .addUserOption((o) => o.setName("staff").setDescription("Staff member to transfer to").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: any) {
  const targetUser = interaction.options.getUser("staff", true);
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

  // Release current claim
  await supabase
    .from("ticket_claims")
    .update({ released_at: new Date().toISOString() })
    .eq("ticket_id", ticket.id)
    .is("released_at", null);

  // Set new claim
  await supabase.from("tickets").update({ claimed_by: targetUser.id }).eq("id", ticket.id);
  await supabase.from("ticket_claims").insert({ ticket_id: ticket.id, staff_id: targetUser.id });

  const embed = new EmbedBuilder()
    .setDescription(`🔄 Ticket transferred to <@${targetUser.id}> by <@${interaction.user.id}>`)
    .setColor(0x3498db);
    
  await channel.send({ content: `<@${targetUser.id}>`, embeds: [embed] });
  await sendTicketLog(
    interaction.client,
    interaction.guild,
    `🔄 **Ticket Transferred**\nTicket: #${ticket.id}\nFrom: ${ticket.claimed_by ? `<@${ticket.claimed_by}>` : "None"}\nTo: <@${targetUser.id}>`
  );

  await interaction.editReply("✅ Ticket transferred successfully.");
}
