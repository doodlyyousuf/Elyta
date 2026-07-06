
import {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
} from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";
import { getCategoryEmoji } from "./categories.js";
import { getOrCreateTicketCategory } from "./categoryChannel.js";
import { MAX_TICKETS_PER_USER, supportRoles } from "../../config.js";
import { getGuild } from "../../database/db.js";

type TicketInteraction = AnySelectMenuInteraction | ButtonInteraction;

/**
 * Returns the union of the globally-configured support roles (from config.ts)
 * and any per-guild `support_role_ids` configured on `guild_settings`.
 *
 * The `support_role_ids` column is OPTIONAL — older schemas may not have it,
 * so we read it defensively and fall back to the global `supportRoles`.
 */
async function resolveSupportRoleIds(guildId: string): Promise<string[]> {
  const ids = new Set<string>(supportRoles);
  try {
    const guild = await getGuild(guildId);
    const perGuild = guild?.support_role_ids;
    if (Array.isArray(perGuild)) {
      for (const id of perGuild) {
        if (typeof id === "string" && id.trim()) ids.add(id.trim());
      }
    }
  } catch {
    // Fall back to global support roles only.
  }
  return [...ids];
}

/**
 * Create a ticket channel, DB row, welcome embed, action buttons, and log entry.
 *
 * Fixes C-06: previously the configured support roles were never added to the
 * channel's permission overwrites, so staff couldn't see tickets. We now grant
 * ViewChannel + SendMessages + ReadMessageHistory to every role returned by
 * `resolveSupportRoleIds(guild.id)`.
 */
export async function createTicket(
  interaction: TicketInteraction,
  category: string,
  priority: string = "medium"
): Promise<void> {
  const guild = interaction.guild as Guild;
  const user = interaction.user;

  const { data: existing } = await supabase
    .from("tickets")
    .select("*")
    .eq("guild_id", guild.id)
    .eq("user_id", user.id)
    .eq("status", "open");

  if (existing && existing.length >= MAX_TICKETS_PER_USER) {
    await interaction.followUp({
      content: `❌ You have reached the limit of ${MAX_TICKETS_PER_USER} open tickets.`,
      ephemeral: true,
    });
    return;
  }

  const categoryEmoji = getCategoryEmoji(category);
  const priorityEmoji = priority === "high" ? "🔴" : priority === "low" ? "🟢" : "🟡";
  const parentId = await getOrCreateTicketCategory(guild);

  // Build permission overwrites:
  //   • @everyone — deny ViewChannel
  //   • ticket author — allow View+Send+ReadHistory
  //   • bot — allow ViewChannel
  //   • each support role — allow View+Send+ReadHistory (C-06 fix)
  const supportRoleIds = await resolveSupportRoleIds(guild.id);
  const allowStaff = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];
  const allowAuthor = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];

  const overwrites: OverwriteResolvable[] = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: allowAuthor },
    { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
  ];
  for (const roleId of supportRoleIds) {
    if (roleId === guild.id || roleId === user.id || roleId === interaction.client.user.id) continue;
    // Only add overwrites for roles that actually exist in THIS guild. A role ID
    // from the global SUPPORT_ROLE_IDS env or a stale per-guild config that isn't
    // in the cache causes "Supplied parameter is not a cached User or Role."
    if (!guild.roles.cache.has(roleId)) continue;
    overwrites.push({ id: roleId, allow: allowStaff, type: 0 /* Role */ });
  }

  const channel = await guild.channels.create({
    name: `${priorityEmoji}-${categoryEmoji}-ticket-${user.username}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Ticket for ${user.tag} | Category: ${category} | Priority: ${priority}`,
    permissionOverwrites: overwrites,
  });

  const { data: ticket } = await supabase
    .from("tickets")
    .insert({
      guild_id: guild.id,
      user_id: user.id,
      channel_id: channel.id,
      status: "open",
      category,
      priority,
    })
    .select()
    .single();

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`${priorityEmoji} ${categoryEmoji} Ticket Created`)
    .setDescription(`Hello ${user}! A staff member will assist you shortly.`)
    .setColor(priority === "high" ? 0xff0000 : priority === "low" ? 0x00ff00 : 0xffff00)
    .addFields(
      { name: "Category", value: category, inline: true },
      { name: "Priority", value: priority.charAt(0).toUpperCase() + priority.slice(1), inline: true },
      { name: "Ticket ID", value: `#${ticket?.id ?? "?"}`, inline: true }
    )
    .setTimestamp();

  const closeBtn = new ButtonBuilder()
    .setCustomId("ticket_close")
    .setLabel("Close")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🔒");
  const claimBtn = new ButtonBuilder()
    .setCustomId("ticket_claim")
    .setLabel("Claim")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("👤");
  const releaseBtn = new ButtonBuilder()
    .setCustomId("ticket_release")
    .setLabel("Release")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("🔓");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn, claimBtn, releaseBtn);

  await (channel as TextChannel).send({
    content: `<@${user.id}>`,
    embeds: [welcomeEmbed],
    components: [row],
  });
  await sendTicketLog(
    interaction.client,
    guild,
    `✅ **Ticket Created**\nUser: ${user.tag}\nChannel: ${channel}\nCategory: ${categoryEmoji} ${category}`
  );

  await interaction.followUp({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}
