
import { SlashCommandBuilder, ChannelType, PermissionsBitField } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { getOrCreateTicketCategory } from "../../systems/tickets/categoryChannel.js";
import { MAX_TICKETS_PER_USER } from "../../config.js";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Create a support ticket")
  .addStringOption((o) => o.setName("subject").setDescription("Brief subject").setRequired(true));

export async function execute(interaction: any) {
  const subject = interaction.options.getString("subject", true);
  const userId = interaction.user.id;
  const guild = interaction.guild;

  const { data: existing } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guild.id)
    .eq("user_id", userId)
    .eq("status", "open");

  if (existing && existing.length >= MAX_TICKETS_PER_USER) {
    return interaction.editReply(`❌ You have reached the limit of ${MAX_TICKETS_PER_USER} open tickets.`);
  }

  const parentId = await getOrCreateTicketCategory(guild);
  const channel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Subject: ${subject}`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
    ],
  });

  await supabase.from("tickets").insert({ guild_id: guild.id, user_id: userId, channel_id: channel.id, status: "open", category: "support" });
  await channel.send(`<@${userId}> Your ticket has been created. Subject: ${subject}`);
  await interaction.editReply(`✅ Ticket created: ${channel}`);
}
