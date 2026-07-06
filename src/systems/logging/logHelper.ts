
import { EmbedBuilder, Guild, TextChannel } from "discord.js";
import { getGuild } from "../../database/db.js";

/**
 * Resolve a per-guild log channel for a specific log "kind".
 *
 * Falls back to the generic `log_channel_id` when the kind-specific column is
 * not configured. Returns `undefined` when no channel is configured OR the
 * configured channel can't be found in the cache — in which case the caller
 * NO-OPs (M-06: we never auto-create channels any more).
 */
async function resolveLogChannel(
  guild: Guild,
  kindSpecificColumn: "mod_log_channel_id" | "role_log_channel_id" | "channel_log_channel_id"
): Promise<TextChannel | undefined> {
  let settings: Record<string, unknown> | null = null;
  try {
    settings = await getGuild(guild.id);
  } catch (err) {
    console.warn(`[logHelper] Failed to read guild_settings for ${guild.id}:`, err);
    return undefined;
  }

  const specificId = settings?.[kindSpecificColumn];
  const fallbackId = settings?.["log_channel_id"];

  const candidateId =
    (typeof specificId === "string" && specificId.trim()) ||
    (typeof fallbackId === "string" && fallbackId.trim()) ||
    undefined;
  if (!candidateId) return undefined;

  const channel = guild.channels.cache.get(candidateId) as TextChannel | undefined;
  if (channel && channel.isTextBased()) return channel;

  // Not in cache — try a fetch (the channel may exist but be uncached).
  try {
    const fetched = await guild.channels.fetch(candidateId);
    if (fetched && fetched.isTextBased()) return fetched as TextChannel;
  } catch {
    /* channel missing or inaccessible — treat as unconfigured */
  }
  return undefined;
}

async function sendToChannel(
  channel: TextChannel,
  title: string,
  description: string,
  color: number
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[logHelper] Failed to send log message:", err);
  }
}

/**
 * Send a moderation log embed to this guild's configured mod-log channel
 * (falls back to the generic log channel). NO-OPs when no channel is
 * configured — never auto-creates one (M-06 fix).
 */
export async function sendModLog(
  guild: Guild,
  title: string,
  description: string,
  color: number = 0x5865f2
): Promise<void> {
  const channel = await resolveLogChannel(guild, "mod_log_channel_id");
  if (!channel) return;
  await sendToChannel(channel, title, description, color);
}

/**
 * Send a role-change log embed to this guild's configured role-log channel
 * (falls back to the generic log channel). NO-OPs when no channel is
 * configured — never auto-creates one (M-06 fix).
 */
export async function sendRoleLog(
  guild: Guild,
  title: string,
  description: string,
  color: number = 0x5865f2
): Promise<void> {
  const channel = await resolveLogChannel(guild, "role_log_channel_id");
  if (!channel) return;
  await sendToChannel(channel, title, description, color);
}

/**
 * Send a channel-change log embed to this guild's configured channel-log
 * channel (falls back to the generic log channel). NO-OPs when no channel is
 * configured — never auto-creates one (M-06 fix).
 */
export async function sendChannelLog(
  guild: Guild,
  title: string,
  description: string,
  color: number = 0x5865f2
): Promise<void> {
  const channel = await resolveLogChannel(guild, "channel_log_channel_id");
  if (!channel) return;
  await sendToChannel(channel, title, description, color);
}
