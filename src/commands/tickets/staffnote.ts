
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { buildStaffNoteModal, viewStaffNotes } from "../../systems/tickets/staffNotes.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("staffnote")
  .setDescription("Manage staff notes for the current ticket")
  .addSubcommand((subcommand) =>
    subcommand.setName("add").setDescription("Add a staff note to this ticket")
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("view").setDescription("View all staff notes for this ticket")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const channel = interaction.channel;
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("channel_id", channel.id)
      .single();

    if (!ticket) {
      return interaction.editReply({ content: "❌ This is not a ticket channel." });
    }

    // showModal can only be used on an unacknowledged interaction. interactionCreate
    // already deferred the reply, so we cannot show a modal here directly. Instead,
    // send a button that re-opens the modal flow. (The modal is handled by the
    // staff_note_<ticketId> customId in interactionCreate.)
    const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import("discord.js");
    const openBtn = new ButtonBuilder()
      .setCustomId(`staff_note_${ticket.id}`)
      .setLabel("Add Staff Note")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📝");
    const row = new ActionRowBuilder().addComponents(openBtn);
    return interaction.editReply({ content: "Click to add a staff note:", components: [row] });
  } else if (subcommand === "view") {
    // interactionCreate already deferred — don't re-defer.
    return viewStaffNotes(interaction);
  }
}
