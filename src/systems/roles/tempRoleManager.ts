
import { supabase } from "../../database/supabase.js";

export async function checkExpiredTempRoles(client: any) {
  const { data: expiredRoles } = await supabase
    .from("temporary_roles")
    .select("*")
    .lt("expires_at", new Date().toISOString());

  if (!expiredRoles) return;

  for (const tempRole of expiredRoles) {
    try {
      const guild = await client.guilds.fetch(tempRole.guild_id).catch(() => null);
      if (!guild) continue;

      const member = await guild.members.fetch(tempRole.user_id).catch(() => null);
      if (member) {
        const role = guild.roles.cache.get(tempRole.role_id);
        if (role) {
          await member.roles.remove(role).catch(() => {});
        }
      }

      await supabase.from("temporary_roles").delete().eq("id", tempRole.id);
    } catch (error) {
      console.error("Error removing temporary role:", error);
    }
  }
}

export async function checkRoleRewards(guild: any, userId: string, inviteCount: number) {
  const { data: rewards } = await supabase
    .from("role_rewards")
    .select("*")
    .eq("guild_id", guild.id)
    .lte("required_invites", inviteCount);

  if (!rewards) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  for (const reward of rewards) {
    const role = guild.roles.cache.get(reward.role_id);
    if (role && !member.roles.cache.has(reward.role_id)) {
      await member.roles.add(role).catch(() => {});
    }
  }
}
