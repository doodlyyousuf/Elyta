
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("ticket-note")
  .setDescription("Manage private staff notes on a ticket")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a private note to the current ticket")
      .addStringOption((o) =>
        o.setName("note").setDescription("The note content").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View all notes for the current ticket")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: any) {
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

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const note = interaction.options.getString("note", true);

    const { error } = await supabase.from("ticket_notes").insert({
      ticket_id: ticket.id,
      staff_id: interaction.user.id,
      note,
    });

    if (error) {
      console.error("Failed to insert ticket note:", error);
      return interaction.editReply("❌ Failed to save the note.");
    }

    return interaction.editReply(`✅ Note added to ticket #${ticket.id}.`);
  }

  if (subcommand === "view") {
    const { data: notes, error } = await supabase
      .from("ticket_notes")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch ticket notes:", error);
      return interaction.editReply("❌ Failed to fetch notes.");
    }

    if (!notes || notes.length === 0) {
      return interaction.editReply("📝 No notes found for this ticket.");
    }

    const embeds = notes.slice(0, 10).map((n: any, i: number) => {
      const timestamp = n.created_at
        ? `<t:${Math.floor(new Date(n.created_at).getTime() / 1000)}:R>`
        : "Unknown";
      return new EmbedBuilder()
        .setTitle(`📝 Note #${i + 1}`)
        .setDescription(n.note)
        .addFields(
          { name: "Staff", value: `<@${n.staff_id}>`, inline: true },
          { name: "Added", value: timestamp, inline: true }
        )
        .setColor(0x5865f2)
        .setFooter({ text: `Note ID: ${n.id}` });
    });

    return interaction.editReply({ content: `📋 **Notes for ticket #${ticket.id}** (${notes.length} total):`, embeds });
  }
}
