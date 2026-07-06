import { supabase } from "../../database/supabase.js";

export async function containsBadWord(content: string, guildId: string): Promise<boolean> {
  const { data } = await supabase
    .from("filtered_words")
    .select("word")
    .eq("guild_id", guildId);
  if (!data?.length) return false;
  const lower = content.toLowerCase();
  return data.some((row) => lower.includes(row.word.toLowerCase()));
}
