
import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  type ButtonInteraction,
  type Guild,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";
import { generateTranscript } from "./transcript.js";
import { archiveTicketImages } from "./images.js";
import { buildCloseReasonModal } from "./closeReasonModal.js";
import { getGuild } from "../../database/db.js";

/**
 * Called when the close button is pressed. Shows the close reason modal.
 * The interaction must NOT be deferred before calling this.
 */
export async function closeTicket(interaction: ButtonInteraction): Promise<void> {
  const channel = interaction.channel as TextChannel;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "open")
    .single();

  if (!ticket) {
    // Can't show a modal for an error, so reply ephemerally instead
    await interaction.reply({ content: "❌ This is not an open ticket channel.", ephemeral: true });
    return;
  }

  const modal = buildCloseReasonModal(ticket.id);
  await interaction.showModal(modal);
}

/**
 * Executes the actual close logic after the modal is submitted.
 * The interaction here is the modal submit interaction (already deferred).
 *
 * Fixes:
 *   • H-05 (Architecture): the archive channel ID was hardcoded to
 *     "1511444676681535588". We now read `archive_channel_id` from the
 *     per-guild `guild_settings` row via `getGuild(guild.id)`. If it isn't
 *     configured OR the channel can't be found, we NO-OP the channel send
 *     (still persist the transcript row to the DB) and log a warning — we do
 *     NOT auto-create a fallback channel.
 *   • M-08 (Reliability): the channel used to be deleted via a 3-second
 *     setTimeout that would orphan the channel if the bot restarted inside
 *     that window. We now `await channel.delete()` immediately (in a
 *     try/catch) AFTER sending the "will be deleted" embed.
 */
export async function executeClose(
  interaction: ModalSubmitInteraction,
  ticketId: number,
  reason: string
): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild as Guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    await interaction.followUp({ content: "❌ Ticket not found.", ephemeral: true });
    return;
  }

  await interaction.followUp({ content: "🔒 Closing ticket...", ephemeral: true });

  // Generate transcript
  const html = await generateTranscript(channel, ticket);
  const fileName = `transcript-${ticket.id}-${Date.now()}.html`;
  const file = new AttachmentBuilder(Buffer.from(html), { name: fileName });

  // H-05: Read the per-guild archive channel from guild_settings.
  // If not configured or not found, skip channel archival but still store
  // the transcript row in the DB.
  let transcriptUrl = "";
  let archiveChannel: TextChannel | undefined;
  try {
    const settings = await getGuild(guild.id);
    const archiveChannelId = settings?.archive_channel_id;
    if (archiveChannelId) {
      const fromCache = guild.channels.cache.get(archiveChannelId);
      if (fromCache && fromCache.isTextBased()) {
        archiveChannel = fromCache as TextChannel;
      } else {
        const fetched = await guild.channels.fetch(archiveChannelId).catch(() => null);
        if (fetched && fetched.isTextBased()) {
          archiveChannel = fetched as TextChannel;
        }
      }
    }
  } catch (err) {
    console.warn("[tickets.close] Failed to read guild_settings for archive channel:", err);
  }

  if (archiveChannel) {
    try {
      const sent = await archiveChannel.send({
        content: `Transcript for ticket #${ticket.id}`,
        files: [file],
      });
      transcriptUrl = sent.attachments.first()?.url ?? "";
    } catch (err) {
      console.warn(`[tickets.close] Failed to send transcript to archive channel for #${ticket.id}:`, err);
    }
  } else {
    console.warn(
      `[tickets.close] No archive_channel_id configured for guild ${guild.id}; ` +
        `transcript for ticket #${ticket.id} was stored in the DB only.`
    );
  }

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

  // Send closing embed in channel BEFORE deletion
  const closingEmbed = new EmbedBuilder()
    .setDescription("🔒 This ticket will be deleted...")
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

  // M-08: Delete the channel immediately. The previous 3-second setTimeout
  // orphaned channels when the bot restarted inside that window.
  try {
    await channel.delete();
  } catch (err) {
    console.error(`[tickets.close] Failed to delete ticket channel ${channel.id}:`, err);
  }
}
