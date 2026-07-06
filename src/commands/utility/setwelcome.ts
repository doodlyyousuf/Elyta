
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("setwelcome")
  .setDescription("Configure welcome messages")
  .addSubcommand((s) =>
    s.setName("channel").setDescription("Set welcome channel")
      .addChannelOption((o) => o.setName("channel").setDescription("Welcome channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
  )
  .addSubcommand((s) =>
    s.setName("message").setDescription("Set welcome message")
      .addStringOption((o) => o.setName("message").setDescription("Message template (use {user}, {server}, {memberCount})").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("accountage").setDescription("Set minimum account age requirement")
      .addIntegerOption((o) => o.setName("days").setDescription("Minimum account age in days (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(365))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();

  if (sub === "channel") {
    const channel = interaction.options.getChannel("channel", true);
    await supabase.from("guild_settings").upsert({
      guild_id: interaction.guildId,
      welcome_channel_id: channel.id,
    });
    await interaction.editReply(`✅ Welcome channel set to ${channel}`);
  } else if (sub === "message") {
    const message = interaction.options.getString("message", true);
    await supabase.from("guild_settings").upsert({
      guild_id: interaction.guildId,
      welcome_message: message,
    });
    await interaction.editReply(`✅ Welcome message set.`);
  } else if (sub === "accountage") {
    const days = interaction.options.getInteger("days", true);
    await supabase.from("guild_settings").upsert({
      guild_id: interaction.guildId,
      min_account_age_days: days,
    });
    if (days === 0) {
      await interaction.editReply(`✅ Account age check disabled.`);
    } else {
      await interaction.editReply(`✅ Minimum account age set to ${days} days.`);
    }
  }
}
