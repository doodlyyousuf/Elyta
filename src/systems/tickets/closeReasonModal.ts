
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

export function buildCloseReasonModal(ticketId: number): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`close_reason_${ticketId}`)
    .setTitle("Close Ticket");

  const reasonInput = new TextInputBuilder()
    .setCustomId("close_reason_input")
    .setLabel("Reason for closing this ticket")
    .setPlaceholder("Enter the reason for closing...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1024);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(row);

  return modal;
}
