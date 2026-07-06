
import { EmbedBuilder } from "discord.js";
import { sendModLog } from "../systems/logging/logHelper.js";
import { supabase } from "../database/supabase.js";

export default {
  name: "guildMemberRemove",
  async execute(member: any) {
    // Mod log (existing behavior)
    await sendModLog(
      member.guild,
      "👋 Member Left",
      `**${member.user.tag}** (${member.id}) left the server.`,
      0xff6b6b
    );

    // Leave message
    const { data: settings } = await supabase
      .from("guild_settings")
      .select("leave_channel_id, leave_message")
      .eq("guild_id", member.guild.id)
      .maybeSingle();

    if (settings?.leave_channel_id) {
      const channel = member.guild.channels.cache.get(settings.leave_channel_id);
      if (channel) {
        const defaultMsg = "**{user}** has left {server}. We now have {memberCount} members.";
        const template = settings.leave_message || defaultMsg;
        const text = template
          .replace(/{user}/g, member.user.tag)
          .replace(/{server}/g, member.guild.name)
          .replace(/{memberCount}/g, String(member.guild.memberCount));

        const embed = new EmbedBuilder()
          .setTitle("👋 Goodbye!")
          .setDescription(text)
          .setColor(0xff6b6b)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(console.error);
      }
    }
  },
};
