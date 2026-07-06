
import { supabase } from "../../database/supabase.js";

export async function isBlacklisted(guildId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("blacklist")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .single();

  return !!data;
}

export async function addToBlacklist(guildId: string, userId: string, reason: string, addedBy: string): Promise<void> {
  await supabase.from("blacklist").insert({
    guild_id: guildId,
    user_id: userId,
    reason,
    added_by: addedBy,
  });
}

export async function removeFromBlacklist(guildId: string, userId: string): Promise<void> {
  await supabase.from("blacklist").delete().eq("guild_id", guildId).eq("user_id", userId);
}

export async function getBlacklist(guildId: string): Promise<any[]> {
  const { data } = await supabase
    .from("blacklist")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  return data || [];
}
