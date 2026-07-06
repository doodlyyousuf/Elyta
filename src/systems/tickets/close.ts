import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";
import { generateTranscript } from "./transcript.js";
import { archiveTicketImages } from "./images.js";
import { buildCloseReasonModal } from "./closeReasonModal.js";

/**
 * Called when the close button is pressed. Shows the close reason modal.
 * The interaction must NOT be deferred before calling this.
 */
export async function closeTicket(interaction: any) {
  const channel = interaction.channel;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    // Can't show a modal for an error, so reply ephemerally instead
    return interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
  }

  const modal = buildCloseReasonModal(ticket.id);
  await interaction.showModal(modal);
}

/**
 * Executes the actual close logic after the modal is submitted.
 * The interaction here is the modal submit interaction (already deferred).
 */
export async function executeClose(interaction: any, ticketId: number, reason: string) {
  const channel = interaction.channel;
  const guild = interaction.guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return interaction.followUp({ content: "❌ Ticket not found.", ephemeral: true });
  }

  await interaction.followUp({ content: "🔒 Closing ticket...", ephemeral: true });

  // Generate transcript
  const html = await generateTranscript(channel, ticket);
  const fileName = `transcript-${ticket.id}-${Date.now()}.html`;
  const file = new AttachmentBuilder(Buffer.from(html), { name: fileName });

  // Archive transcript
  let archiveChannel = guild.channels.cache.get("1511444676681535588");
  if (!archiveChannel) {
    archiveChannel = guild.channels.cache.find((c: any) => c.name === "ticket-archives");
  }
  if (!archiveChannel) {
    archiveChannel = await guild.channels.create({ name: "ticket-archives", topic: "Ticket transcripts" });
  }

  const sent = await archiveChannel.send({ content: `Transcript for ticket #${ticket.id}`, files: [file] });
  const transcriptUrl = sent.attachments.first()?.url || "";

  await supabase.from("ticket_transcripts").insert({
    ticket_id: ticket.id,
    guild_id: guild.id,
    transcript_url: transcriptUrl,
    file_name: fileName,
  });

  // Archive images
  await archiveTicketImages(channel, ticket.id, guild);

  // Update ticket in DB with close_reason
  await supabase
    .from("tickets")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      close_reason: reason || null,
    })
    .eq("id", ticket.id);

  // Log to ticket-logs
  const reasonText = reason ? `\nReason: ${reason}` : "";
  const logText = `🔒 **Ticket Closed**\nUser: <@${ticket.user_id}>\nID: #${ticket.id}\nClosed by: ${interaction.user.tag}\nCategory: ${ticket.category || "support"}${reasonText}`;

  const reopenBtn = new ButtonBuilder()
    .setCustomId(`ticket_reopen_${ticket.id}`)
    .setLabel("Reopen Ticket")
    .setStyle(ButtonStyle.Success)
    .setEmoji("🔓");
  const reopenRow = new ActionRowBuilder<ButtonBuilder>().addComponents(reopenBtn);
  await sendTicketLog(interaction.client, guild, logText, [reopenRow]);

  // Send closing embed in channel
  const closingEmbed = new EmbedBuilder()
    .setDescription("🔒 This ticket will be deleted in 3 seconds...")
    .setColor(0xff0000);
  await channel.send({ embeds: [closingEmbed] });

  // DM the ticket author with a rating prompt
  try {
    const ticketUser = await interaction.client.users.fetch(ticket.user_id);
    const ratingEmbed = new EmbedBuilder()
      .setTitle("⭐ Rate Your Support Experience")
      .setDescription(
        `Your ticket **#${ticket.id}** has been closed.${reason ? `\n**Reason:** ${reason}` : ""}\n\nPlease rate your experience by clicking a button below:`
      )
      .setColor(0xffd700)
      .setTimestamp();

    const ratingButtons = [1, 2, 3, 4, 5].map((stars) =>
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_${stars}`)
        .setLabel("⭐".repeat(stars))
        .setStyle(ButtonStyle.Secondary)
    );
    const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(ratingButtons);

    await ticketUser.send({ embeds: [ratingEmbed], components: [ratingRow] });
  } catch (err) {
    console.error("Failed to send rating DM:", err);
  }

  // Delete channel after delay
  setTimeout(() => channel.delete().catch(() => {}), 3000);
}
