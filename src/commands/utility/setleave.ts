
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("setleave")
  .setDescription("Configure leave messages")
  .addSubcommand((s) =>
    s.setName("channel").setDescription("Set leave channel")
      .addChannelOption((o) => o.setName("channel").setDescription("Leave channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand((s) =>
    s.setName("message").setDescription("Set leave message")
      .addStringOption((o) => o.setName("message").setDescription("Message template (use {user}, {server}, {memberCount})").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel", true);
    await supabase.from("guild_settings").upsert({
      guild_id: interaction.guildId,
      leave_channel_id: channel.id,
    });
    await interaction.editReply(`✅ Leave channel set to ${channel}`);
  } else if (sub === "message") {
    const message = interaction.options.getString("message", true);
    await supabase.from("guild_settings").upsert({
      guild_id: interaction.guildId,
      leave_message: message,
    });
    await interaction.editReply(`✅ Leave message set.`);
  }
}
