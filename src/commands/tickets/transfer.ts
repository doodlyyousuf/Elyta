
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { transferTicket } from "../../systems/tickets/transfer.js";

export const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Transfer a claimed ticket to another staff member")
  .addUserOption((option) =>
    option.setName("staff").setDescription("The staff member to transfer to").setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  const targetUser = interaction.options.getUser("staff");
  await transferTicket(interaction, targetUser);
}
