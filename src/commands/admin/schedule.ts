
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("Schedule an announcement")
  .addStringOption((o) => o.setName("message").setDescription("Message to send").setRequired(true))
  .addChannelOption((o) => o.setName("channel").setDescription("Channel to send to").setRequired(true).addChannelTypes(ChannelType.GuildText))
  .addStringOption((o) => o.setName("time").setDescription("Time to send (YYYY-MM-DD HH:MM)").setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const message = interaction.options.getString("message", true);
  const channel = interaction.options.getChannel("channel", true);
  const timeStr = interaction.options.getString("time", true);

  const scheduledTime = new Date(timeStr);
  if (isNaN(scheduledTime.getTime())) {
    return interaction.editReply("❌ Invalid time format. Use YYYY-MM-DD HH:MM");
  }

  if (scheduledTime <= new Date()) {
    return interaction.editReply("❌ Scheduled time must be in the future.");
  }

  await supabase.from("scheduled_announcements").insert({
    guild_id: interaction.guildId,
    channel_id: channel.id,
    message,
    scheduled_at: scheduledTime.toISOString(),
    created_by: interaction.user.id,
  });

  await interaction.editReply(`✅ Announcement scheduled for ${scheduledTime.toLocaleString()}`);
}
