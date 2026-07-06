
import { supabase } from "../../database/supabase.js";

export async function detectFakeInvite(member: any): Promise<boolean> {
  const guild = member.guild;
  
  // Check if account is very new (less than 3 days old)
  const accountAge = Date.now() - member.user.createdTimestamp;
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
  
  if (accountAge < threeDaysInMs) {
    return true;
  }

  // Check if user has no avatar (common for fake accounts)
  if (!member.user.avatar) {
    return true;
  }

  // Check if user has no discriminator (new accounts)
  if (member.user.discriminator === "0000") {
    return true;
  }

  // Check if user has left and rejoined quickly
  const { data: previousJoins } = await supabase
    .from("invite_tracking")
    .select("*")
    .eq("user_id", member.user.id)
    .eq("guild_id", guild.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (previousJoins && previousJoins.length > 0) {
    const lastJoin = new Date(previousJoins[0].created_at);
    const timeSinceLastJoin = Date.now() - lastJoin.getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    
    if (timeSinceLastJoin < oneDayInMs) {
      return true;
    }
  }

  return false;
}

export async function markFakeInvite(guildId: string, userId: string, inviterId: string) {
  await supabase.from("fake_invites").insert({
    guild_id: guildId,
    user_id: userId,
    inviter_id: inviterId,
  });
}
