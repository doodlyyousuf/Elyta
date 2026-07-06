
import { supabase } from "./supabase.js";

export async function getGuild(guildId: string) {
  const { data } = await supabase
    .from("guild_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();
  return data;
}

export async function createGuild(guildId: string) {
  const { data, error } = await supabase
    .from("guild_settings")
    .upsert({ guild_id: guildId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTicket(guildId: string, userId: string, channelId: string, category = "support") {
  const { data, error } = await supabase
    .from("tickets")
    .insert({ guild_id: guildId, user_id: userId, channel_id: channelId, status: "open", category })
    .select()
    .single();
  if (error) throw error;
  return data;
}
