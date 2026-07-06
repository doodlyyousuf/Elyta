import {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";
import { getCategoryEmoji } from "./categories.js";
import { getOrCreateTicketCategory } from "./categoryChannel.js";
import { MAX_TICKETS_PER_USER } from "../../config.js";

export async function reopenTicket(interaction: any, ticketId: number) {
  const guild = interaction.guild;

  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("guild_id", guild.id)
    .single();

  if (!ticket) {
    return interaction.followUp({ content: "❌ Ticket not found.", ephemeral: true });
  }
  if (ticket.status !== "closed") {
    return interaction.followUp({ content: "❌ This ticket is already open.", ephemeral: true });
  }

  const { data: existingOpen } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guild.id)
    .eq("user_id", ticket.user_id)
    .eq("status", "open");

  if (existingOpen && existingOpen.length >= MAX_TICKETS_PER_USER) {
    return interaction.followUp({ content: `❌ This user already has the maximum of ${MAX_TICKETS_PER_USER} open tickets.`, ephemeral: true });
  }

  const user = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
  if (!user) {
    return interaction.followUp({ content: "❌ Could not find the ticket owner.", ephemeral: true });
  }

  const categoryEmoji = getCategoryEmoji(ticket.category || "support");
  const parentId = await getOrCreateTicketCategory(guild);
  const channel = await guild.channels.create({
    name: `${categoryEmoji}-ticket-${user.username}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Reopened ticket for ${user.tag} | Category: ${ticket.category || "support"}`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
    ],
  });

  await supabase
    .from("tickets")
    .update({ status: "open", channel_id: channel.id, claimed_by: null })
    .eq("id", ticket.id);

  const welcomeEmbed = new EmbedBuilder()
    .setTitle("🔓 Ticket Reopened")
    .setDescription(`Welcome back ${user}! Support will continue shortly.`)
    .setColor(0x00ffcc)
    .addFields(
      { name: "Ticket ID", value: `#${ticket.id}`, inline: true },
      { name: "Category", value: `${categoryEmoji} ${ticket.category || "support"}`, inline: true },
      { name: "Reopened by", value: `<@${interaction.user.id}>`, inline: true }
    )
    .setTimestamp();

  const closeBtn = new ButtonBuilder().setCustomId("ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒");
  const claimBtn = new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Primary).setEmoji("👤");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn, claimBtn);

  await channel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });
  await sendTicketLog(
    interaction.client,
    guild,
    `🔓 **Ticket Reopened**\nUser: ${user.tag}\nChannel: ${channel}\nID: #${ticket.id}\nReopened by: ${interaction.user.tag}`
  );
  await interaction.followUp({ content: `✅ Ticket #${ticket.id} reopened: ${channel}`, ephemeral: true });
}
