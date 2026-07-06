import { supabase } from "../../database/supabase.js";

const violationTracker = new Map<string, number>();

function getKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function recordViolation(guildId: string, userId: string): number {
  const key = getKey(guildId, userId);
  const count = (violationTracker.get(key) || 0) + 1;
  violationTracker.set(key, count);
  return count;
}

export async function applyAutoPunishment(message: any, reason: string, count: number) {
  const member = message.member;
  if (!member || member.permissions.has("ManageMessages")) return null;

  if (count >= 5) {
    if (member.kickable) {
      await member.kick(`AutoMod: ${reason} (${count} violations)`);
      return "kicked";
    }
  } else if (count >= 3) {
    if (member.moderatable) {
      await member.timeout(10 * 60 * 1000, `AutoMod: ${reason} (${count} violations)`);
      return "muted";
    }
  } else if (count >= 2) {
    await supabase.from("warnings").insert({
      guild_id: message.guild.id,
      user_id: message.author.id,
      reason: `AutoMod: ${reason}`,
      moderator_id: message.client.user.id,
    });
    return "warned";
  }
  return null;
}
