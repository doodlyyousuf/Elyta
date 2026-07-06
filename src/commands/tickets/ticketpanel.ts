
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { buildTicketPanelEmbed, buildTicketPanelButtons } from "../../systems/tickets/panel.js";

export const data = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Send the ticket panel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  await interaction.channel.send({
    embeds: [buildTicketPanelEmbed()],
    components: buildTicketPanelButtons(),
  });
  await interaction.editReply("✅ Ticket panel sent!");
}
