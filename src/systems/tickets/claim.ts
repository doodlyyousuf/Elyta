
import { EmbedBuilder, type ButtonInteraction, type Guild, type GuildMember, type TextChannel } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";
import { isStaff } from "../security/permissions.js";

/**
 * Claim an open ticket on behalf of the clicking user.
 *
 * Fixes:
 *   • H-04 (Security): previously any member could claim. We now require
 *     `isStaff(member)` and fetch a full GuildMember when the partial API
 *     object lacks role cache.
 *   • M-05 (UX): previously claiming muted the author by removing their
 *     SendMessages permission. "Claim" should signal ownership, not silence
 *     the user — the mute block is removed entirely.
 */
export async function claimTicket(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild as Guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    await interaction.followUp({ content: "❌ This is not an open ticket channel.", ephemeral: true });
    return;
  }
  if (ticket.claimed_by) {
    await interaction.followUp({ content: `❌ Already claimed by <@${ticket.claimed_by}>.`, ephemeral: true });
    return;
  }

  // H-04: Only staff may claim. `interaction.member` may be a partial API
  // object without a role cache, so fetch a full GuildMember to be safe.
  let member: GuildMember | undefined;
  try {
    member = interaction.member instanceof GuildMember
      ? interaction.member
      : await guild.members.fetch(interaction.user.id);
  } catch {
    member = undefined;
  }
  if (!member || !isStaff(member)) {
    await interaction.followUp({
      content: "❌ Only staff can claim tickets.",
      ephemeral: true,
    });
    return;
  }

  await supabase.from("tickets").update({ claimed_by: interaction.user.id }).eq("id", ticket.id);
  await supabase
    .from("ticket_claims")
    .insert({ ticket_id: ticket.id, staff_id: interaction.user.id });

  // M-05: Do NOT mute the ticket author. "Claim" is ownership, not a gag.

  const embed = new EmbedBuilder()
    .setDescription(`🔒 Ticket claimed by <@${interaction.user.id}>`)
    .setColor(0xffaa00);
  await channel.send({ embeds: [embed] });
  await sendTicketLog(
    interaction.client,
    guild,
    `👤 **Ticket Claimed**\nStaff: ${interaction.user.tag}\nTicket: #${ticket.id}`
  );
  await interaction.followUp({ content: "✅ You claimed this ticket.", ephemeral: true });
}
