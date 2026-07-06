
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { deleteTicket } from "../../systems/tickets/delete.js";

export const data = new SlashCommandBuilder()
  .setName("deleteticket")
  .setDescription("Delete a closed ticket channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  await deleteTicket(interaction);
}
