import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("leave-message")
  .setDescription("Configure the leave message channel and message")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("The channel to send leave messages in")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("message")
      .setDescription("Custom leave message. Use {user}, {server}, {memberCount} as placeholders")
      .setRequired(false)
  );

export async function execute(interaction: any) {
  const channel = interaction.options.getChannel("channel", true);
  const message = interaction.options.getString("message");

  const updateData: Record<string, any> = {
    guild_id: interaction.guildId,
    leave_channel_id: channel.id,
  };
  if (message) {
    updateData.leave_message = message;
  }

  const { error } = await supabase
    .from("guild_settings")
    .upsert(updateData, { onConflict: "guild_id" });

  if (error) {
    console.error("Failed to update leave settings:", error);
    return interaction.editReply("❌ Failed to save leave settings. Please try again.");
  }

  let reply = `✅ Leave message channel set to ${channel}.`;
  if (message) {
    reply += `\n📝 Custom message: \`${message}\``;
  } else {
    reply += `\n📝 Using default message. You can set a custom one with the \`message\` option.`;
  }
  reply += `\n\n💡 **Placeholders:** \`{user}\` = username, \`{server}\` = server name, \`{memberCount}\` = member count`;

  await interaction.editReply(reply);
}
