
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { reopenTicket } from "../../systems/tickets/reopen.js";

export const data = new SlashCommandBuilder()
  .setName("ticket-reopen")
  .setDescription("Reopen a closed ticket")
  .addIntegerOption((o) => o.setName("id").setDescription("Ticket ID").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  const ticketId = interaction.options.getInteger("id", true);
  await reopenTicket(interaction, ticketId);
}
