
import { Guild, TextChannel, EmbedBuilder, AuditLogEvent } from "discord.js";
import { supabase } from "../../database/supabase.js";

export interface LoggingConfig {
  guild_id: string;
  enabled: boolean;
  log_channel_id: string;
  message_delete: boolean;
  message_edit: boolean;
  member_join: boolean;
  member_leave: boolean;
  voice_state: boolean;
  role_update: boolean;
  channel_create: boolean;
  channel_delete: boolean;
  ban_kick: boolean;
  server_update: boolean;
  emoji_sticker: boolean;
}

// ── M-03: in-memory per-guild config cache with TTL ─────────────────────────
// Previously `getLoggingConfig` issued a Supabase query on EVERY loggable
// event, which is wasteful and adds latency. We now cache per guild for
// `LOGGING_CONFIG_TTL_MS`; `setLoggingConfig` busts the cache via
// `invalidateLoggingConfig` so changes are visible immediately.

const LOGGING_CONFIG_TTL_MS = 60_000;

interface CachedEntry {
  config: LoggingConfig;
  fetchedAt: number;
}

const configCache = new Map<string, CachedEntry>();

function defaultConfig(guildId: string): LoggingConfig {
  return {
    guild_id: guildId,
    enabled: false,
    log_channel_id: "",
    message_delete: true,
    message_edit: false,
    member_join: true,
    member_leave: true,
    voice_state: false,
    role_update: true,
    channel_create: true,
    channel_delete: true,
    ban_kick: true,
    server_update: false,
    emoji_sticker: false,
  };
}

/**
 * Bust the cached `LoggingConfig` for a guild. Call this after writing config
 * (done automatically inside `setLoggingConfig`) or whenever an external
 * process mutates the row.
 */
export function invalidateLoggingConfig(guildId: string): void {
  configCache.delete(guildId);
}

export async function getLoggingConfig(guildId: string): Promise<LoggingConfig> {
  const cached = configCache.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < LOGGING_CONFIG_TTL_MS) {
    return cached.config;
  }

  const { data, error } = await supabase
    .from("logging_config")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  const config = error || !data ? defaultConfig(guildId) : (data as LoggingConfig);
  configCache.set(guildId, { config, fetchedAt: Date.now() });
  return config;
}

export async function setLoggingConfig(config: LoggingConfig): Promise<void> {
  const { error } = await supabase.from("logging_config").upsert(config);
  if (error) throw error;
  // Bust the cache so the next `getLoggingConfig` reflects the new values.
  invalidateLoggingConfig(config.guild_id);
}

export async function sendLog(
  guild: Guild,
  title: string,
  description: string,
  color: number = 0x5865f2,
  fields?: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  const config = await getLoggingConfig(guild.id);
  if (!config.enabled || !config.log_channel_id) return;

  const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[comprehensiveLogger] Failed to send log:", error);
  }
}

export async function logAuditLogEvent(
  guild: Guild,
  eventType: AuditLogEvent,
  targetId: string,
  executorId: string,
  changes: string[]
): Promise<void> {
  const config = await getLoggingConfig(guild.id);
  if (!config.enabled || !config.log_channel_id) return;

  const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) return;

  const executor = await guild.members.fetch(executorId).catch(() => null);
  const executorName = executor ? executor.user.tag : "Unknown";

  const embed = new EmbedBuilder()
    .setColor(0xffa500)
    .setTitle(`📋 Audit Log: ${eventType}`)
    .setDescription(`**Executor:** ${executorName}\n**Target ID:** ${targetId}`)
    .addFields(changes.map((change) => ({ name: "Change", value: change, inline: false })))
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[comprehensiveLogger] Failed to send audit log:", error);
  }
}
