
import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export function buildStaffNoteModal(ticketId: number) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_note_${ticketId}`)
    .setTitle("Add Staff Note");

  const noteInput = new TextInputBuilder()
    .setCustomId("note_content")
    .setLabel("Note Content")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Enter your staff note here...")
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);
  modal.addComponents(row);

  return modal;
}

export async function addStaffNote(interaction: any, ticketId: number, note: string) {
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

  await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    staff_id: interaction.user.id,
    note: note,
  });

  const embed = new EmbedBuilder()
    .setTitle("📝 Staff Note")
    .setDescription(note)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setColor(0x00bfff)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.followUp({ content: "✅ Staff note added.", ephemeral: true });
}

export async function viewStaffNotes(interaction: any) {
  const channel = interaction.channel;
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .single();

  if (!ticket) {
    return interaction.followUp({ content: "❌ This is not a ticket channel.", ephemeral: true });
  }

  const { data: notes } = await supabase
    .from("ticket_notes")
    .select("*")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  if (!notes || notes.length === 0) {
    return interaction.followUp({ content: "📝 No staff notes found for this ticket.", ephemeral: true });
  }

  const notesList = notes.map((note: any) => {
    const staff = interaction.client.users.cache.get(note.staff_id);
    const staffTag = staff ? staff.tag : "Unknown Staff";
    const timestamp = new Date(note.created_at).toLocaleString();
    return `**${staffTag}** (${timestamp}):\n${note.note}`;
  }).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle(`📝 Staff Notes for Ticket #${ticket.id}`)
    .setDescription(notesList)
    .setColor(0x00bfff)
    .setTimestamp();

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}
