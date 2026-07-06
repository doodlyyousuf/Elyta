import { supabase } from "../../database/supabase.js";
import { checkInviteRewards } from "./inviteRewards.js";
import { detectFakeInvite, markFakeInvite } from "./fakeInviteDetection.js";

let cachedInvites = new Map<string, any>();

export async function cacheInvites(guild: any) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) cachedInvites.set(guild.id, invites);
}

export async function trackInvite(member: any) {
  const guild = member.guild;
  const newInvites = await guild.invites.fetch().catch(() => null);
  if (!newInvites) return;

  const oldInvites = cachedInvites.get(guild.id);
  let inviterId: string | null = null;
  let inviteCode: string | null = null;

  for (const [code, invite] of newInvites) {
    const old = oldInvites?.get(code);
    if (old && invite.uses > old.uses && invite.inviter) {
      inviterId = invite.inviter.id;
      inviteCode = code;
      break;
    }
  }

  // Check for fake invite
  const isFake = await detectFakeInvite(member);
  
  await supabase.from("invite_tracking").insert({
    guild_id: guild.id,
    user_id: member.user.id,
    inviter_id: inviterId,
    code: inviteCode,
    is_fake: isFake,
  });

  if (isFake && inviterId) {
    await markFakeInvite(guild.id, member.user.id, inviterId);
  } else if (inviterId) {
    await checkInviteRewards(guild, inviterId);
  }

  cachedInvites.set(guild.id, newInvites);
}

export async function cacheAllGuildInvites(client: any) {
  for (const guild of client.guilds.cache.values()) {
    await cacheInvites(guild);
  }
}
