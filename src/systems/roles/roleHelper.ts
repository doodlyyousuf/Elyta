
import { supabase } from "../../database/supabase.js";

export async function getButtonRoles(guildId: string) {
  const { data } = await supabase
    .from("button_roles")
    .select("*")
    .eq("guild_id", guildId);
  return data || [];
}

export async function saveButtonRole(guildId: string, roleId: string, label: string, emoji?: string) {
  await supabase.from("button_roles").upsert({
    guild_id: guildId,
    role_id: roleId,
    label,
    emoji: emoji || null,
  });
}
