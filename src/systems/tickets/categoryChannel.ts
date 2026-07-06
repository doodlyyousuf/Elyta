import { ChannelType, type CategoryChannel } from "discord.js";
import { supabase } from "../../database/supabase.js";

const DEFAULT_CATEGORY_NAME = "Tickets";

export async function getOrCreateTicketCategory(guild: any): Promise<string | undefined> {
  const { data: settings } = await supabase
    .from("guild_settings")
    .select("ticket_category_id")
    .eq("guild_id", guild.id)
    .maybeSingle();

  if (settings?.ticket_category_id) {
    const existing = guild.channels.cache.get(settings.ticket_category_id);
    if (existing?.type === ChannelType.GuildCategory) return existing.id;
  }

  const byName = guild.channels.cache.find(
    (c: any) => c.type === ChannelType.GuildCategory && c.name === DEFAULT_CATEGORY_NAME
  ) as CategoryChannel | undefined;

  if (byName) {
    await supabase.from("guild_settings").upsert({ guild_id: guild.id, ticket_category_id: byName.id });
    return byName.id;
  }

  const created = await guild.channels.create({ name: DEFAULT_CATEGORY_NAME, type: ChannelType.GuildCategory });
  await supabase.from("guild_settings").upsert({ guild_id: guild.id, ticket_category_id: created.id });
  return created.id;
}
