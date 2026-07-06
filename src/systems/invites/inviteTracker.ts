
import { Client, Guild, GuildMember, Invite } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { checkInviteRewards } from "./inviteRewards.js";
import { detectFakeInvite, markFakeInvite } from "./fakeInviteDetection.js";

interface CachedInvite {
  uses: number;
  inviter: { id: string } | null;
}

/**
 * Per-guild invite cache, keyed by invite code. Used only to *discover* which
 * invite code's use-count incremented on a join — the actual attribution
 * write is now atomic & idempotent via the `attribute_invite` RPC.
 */
const cachedInvites = new Map<string, Map<string, CachedInvite>>();

function snapshotInvites(invites: Iterable<Invite>): Map<string, CachedInvite> {
  const snap = new Map<string, CachedInvite>();
  for (const inv of invites) {
    snap.set(inv.code, {
      uses: inv.uses ?? 0,
      inviter: inv.inviter ? { id: inv.inviter.id } : null,
    });
  }
  return snap;
}

export async function cacheInvites(guild: Guild): Promise<void> {
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return;
  cachedInvites.set(guild.id, snapshotInvites(invites.values()));
}

/**
 * Attribute a join to the inviter whose invite use-count just incremented.
 *
 * Fixes H-12: previously this inserted a row directly into `invite_tracking`
 * after diffing the cache. Two near-simultaneous joins both read the same
 * cache and both attributed to the same inviter — and a single join could be
 * attributed twice if the event fired more than once. The write is now done
 * via the `attribute_invite` Postgres RPC, which uses
 * `ON CONFLICT (guild_id, user_id) DO NOTHING` so each join is attributed
 * exactly once. Only the agent that wins attribution (RPC returns TRUE)
 * proceeds to `checkInviteRewards` / `markFakeInvite`.
 *
 * Reward-checking and fake-invite marking are wrapped so a thrown error in
 * those steps never breaks the join flow.
 */
export async function trackInvite(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const newInvites = await guild.invites.fetch().catch(() => null);
  if (!newInvites) return;

  // Keep the cache-diff logic to *discover* the inviter — but the *write*
  // is atomic & idempotent.
  const oldInvites = cachedInvites.get(guild.id);
  let inviterId: string | null = null;
  let inviteCode: string | null = null;

  for (const [code, invite] of newInvites) {
    const old = oldInvites?.get(code);
    if (old && (invite.uses ?? 0) > old.uses && invite.inviter) {
      inviterId = invite.inviter.id;
      inviteCode = code;
      break;
    }
  }

  // Best-effort fake-invite detection — don't let it break the join.
  let isFake = false;
  try {
    isFake = await detectFakeInvite(member);
  } catch (err) {
    console.error(
      `[inviteTracker] detectFakeInvite failed for ${member.id}:`,
      err
    );
  }

  // Atomic, idempotent attribution. Returns TRUE if this caller won the
  // attribution (i.e. no prior row existed for this guild+user), FALSE if a
  // row already existed (another concurrent agent already attributed it).
  let attributed = false;
  try {
    const { data, error } = await supabase.rpc("attribute_invite", {
      p_guild_id: guild.id,
      p_user_id: member.user.id,
      p_inviter_id: inviterId,
      p_code: inviteCode,
      p_is_fake: isFake,
    });
    if (error) throw error;
    attributed = Boolean(data);
  } catch (err) {
    console.error(
      `[inviteTracker] attribute_invite failed for ${member.id}:`,
      err
    );
    // Refresh the cache even on failure so subsequent joins diff correctly.
    cachedInvites.set(guild.id, snapshotInvites(newInvites.values()));
    return;
  }

  if (attributed) {
    try {
      if (isFake && inviterId) {
        await markFakeInvite(guild.id, member.user.id, inviterId);
      } else if (inviterId) {
        await checkInviteRewards(guild, inviterId);
      }
    } catch (err) {
      console.error(
        `[inviteTracker] post-attribution step failed for ${member.id}:`,
        err
      );
    }
  }

  cachedInvites.set(guild.id, snapshotInvites(newInvites.values()));
}

export async function cacheAllGuildInvites(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    await cacheInvites(guild);
  }
}
