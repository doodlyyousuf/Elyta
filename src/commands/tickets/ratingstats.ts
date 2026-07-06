
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getTicketStats } from "../../systems/tickets/ratings.js";

export const data = new SlashCommandBuilder()
  .setName("ratingstats")
  .setDescription("View ticket rating statistics")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  await getTicketStats(interaction);
}
