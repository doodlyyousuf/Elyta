
import { supabase } from "../database/supabase.js";

export default {
  name: "messageReactionAdd",
  async execute(reaction: any, user: any) {
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const { data: reactionRole } = await supabase
      .from("reaction_roles")
      .select("*")
      .eq("guild_id", reaction.message.guild.id)
      .eq("channel_id", reaction.message.channel.id)
      .eq("emoji", reaction.emoji.name)
      .single();

    if (!reactionRole) return;

    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = reaction.message.guild.roles.cache.get(reactionRole.role_id);
    if (role) {
      await member.roles.add(role).catch(() => {});
    }
  },
};
