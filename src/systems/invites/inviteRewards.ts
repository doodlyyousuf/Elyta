
import { supabase } from "../../database/supabase.js";
import { checkRoleRewards } from "../roles/tempRoleManager.js";

const DEFAULT_TIERS = [
  { threshold: 5, settingKey: "invite_reward_5" },
  { threshold: 10, settingKey: "invite_reward_10" },
  { threshold: 25, settingKey: "invite_reward_25" },
];

export async function getInviteCount(guildId: string, userId: string): Promise<number> {
  const { count } = await supabase
    .from("invite_tracking")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("inviter_id", userId);
  return count || 0;
}

export async function getInviteLeaderboard(guildId: string, limit = 10) {
  const { data } = await supabase
    .from("invite_tracking")
    .select("inviter_id")
    .eq("guild_id", guildId);

  if (!data?.length) return [];

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.inviter_id) continue;
    counts.set(row.inviter_id, (counts.get(row.inviter_id) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([userId, invites]) => ({ userId, invites }));
}

export async function checkInviteRewards(guild: any, inviterId: string) {
  const inviteCount = await getInviteCount(guild.id, inviterId);
  const member = await guild.members.fetch(inviterId).catch(() => null);
  if (!member) return;

  const { data: settings } = await supabase
    .from("guild_settings")
    .select("invite_reward_5, invite_reward_10, invite_reward_25")
    .eq("guild_id", guild.id)
    .maybeSingle();

  for (const tier of DEFAULT_TIERS) {
    if (inviteCount < tier.threshold) continue;
    const roleId = settings?.[tier.settingKey as keyof typeof settings] as string | undefined;
    if (!roleId) continue;
    const role = guild.roles.cache.get(roleId);
    if (role && !member.roles.cache.has(roleId)) {
      await member.roles.add(role, `Invite reward: ${tier.threshold} invites`).catch(console.error);
    }
  }

  // Check custom role rewards
  await checkRoleRewards(guild, inviterId, inviteCount);
}
