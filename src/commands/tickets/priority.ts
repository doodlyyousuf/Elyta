
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { buildPrioritySelectMenu } from "../../systems/tickets/priority.js";

export const data = new SlashCommandBuilder()
  .setName("priority")
  .setDescription("Change the priority of the current ticket")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: any) {
  const channel = interaction.channel;
  const { supabase } = await import("../../database/supabase.js");
  
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("channel_id", channel.id)
    .single();

  if (!ticket) {
    return interaction.editReply({ content: "❌ This is not a ticket channel."});
  }

  const row = buildPrioritySelectMenu(ticket.id);
  await interaction.editReply({ content: "Select the new priority:", components: [row]});
}
