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

export async function createTicket(interaction: any, category: string, priority: string = "medium") {
  const guild = interaction.guild;
  const user = interaction.user;

  const { data: existing } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guild.id)
    .eq("user_id", user.id)
    .eq("status", "open");

  if (existing && existing.length >= MAX_TICKETS_PER_USER) {
    return interaction.followUp({ content: `❌ You have reached the limit of ${MAX_TICKETS_PER_USER} open tickets.`, ephemeral: true });
  }

  const categoryEmoji = getCategoryEmoji(category);
  const priorityEmoji = priority === "high" ? "🔴" : priority === "low" ? "🟢" : "🟡";
  const parentId = await getOrCreateTicketCategory(guild);
  const channel = await guild.channels.create({
    name: `${priorityEmoji}-${categoryEmoji}-ticket-${user.username}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Ticket for ${user.tag} | Category: ${category} | Priority: ${priority}`,
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

  const { data: ticket } = await supabase
    .from("tickets")
    .insert({ guild_id: guild.id, user_id: user.id, channel_id: channel.id, status: "open", category, priority })
    .select()
    .single();

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`${priorityEmoji} ${categoryEmoji} Ticket Created`)
    .setDescription(`Hello ${user}! A staff member will assist you shortly.`)
    .setColor(priority === "high" ? 0xff0000 : priority === "low" ? 0x00ff00 : 0xffff00)
    .addFields(
      { name: "Category", value: category, inline: true },
      { name: "Priority", value: priority.charAt(0).toUpperCase() + priority.slice(1), inline: true },
      { name: "Ticket ID", value: `#${ticket?.id || "?"}`, inline: true }
    )
    .setTimestamp();

  const closeBtn = new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒");
  const claimBtn = new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("👤");
  const releaseBtn = new ButtonBuilder().setCustomId("ticket_release").setLabel("Release").setStyle(ButtonStyle.Secondary).setEmoji("🔓");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn, claimBtn, releaseBtn);

  await channel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [row] });
  await sendTicketLog(interaction.client, guild, `✅ **Ticket Created**\nUser: ${user.tag}\nChannel: ${channel}\nCategory: ${categoryEmoji} ${category}`);

  await interaction.followUp({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}
