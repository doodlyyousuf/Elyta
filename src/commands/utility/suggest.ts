
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export const data = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Submit a suggestion for the server")
  .addStringOption((o) =>
    o.setName("idea").setDescription("Your suggestion").setRequired(true)
  );

export async function execute(interaction: any) {
  const idea = interaction.options.getString("idea", true);

  // Look up the configured suggestion channel
  const { data: settings } = await supabase
    .from("guild_settings")
    .select("suggestion_channel_id")
    .eq("guild_id", interaction.guildId)
    .maybeSingle();

  if (!settings?.suggestion_channel_id) {
    return interaction.editReply(
      "❌ No suggestion channel configured. Ask an admin to run `/suggestion-config` first."
    );
  }

  const channel = interaction.guild.channels.cache.get(settings.suggestion_channel_id);
  if (!channel) {
    return interaction.editReply(
      "❌ The configured suggestion channel no longer exists. Ask an admin to reconfigure it with `/suggestion-config`."
    );
  }

  const embed = new EmbedBuilder()
    .setTitle("💡 New Suggestion")
    .setDescription(idea)
    .setColor(0xffa500)
    .addFields({ name: "Submitted by", value: `<@${interaction.user.id}>`, inline: true })
    .setFooter({ text: `User ID: ${interaction.user.id}` })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });

  // Add vote reactions
  await msg.react("👍");
  await msg.react("👎");

  // Save to database
  const { error } = await supabase.from("suggestions").insert({
    guild_id: interaction.guildId,
    user_id: interaction.user.id,
    suggestion: idea,
    message_id: msg.id,
  });

  if (error) {
    console.error("Failed to save suggestion:", error);
  }

  await interaction.editReply(`✅ Your suggestion has been posted in ${channel}!`);
}
