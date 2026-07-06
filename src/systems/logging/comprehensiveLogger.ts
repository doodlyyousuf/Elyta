import { createClient } from "@supabase/supabase-js";
import { Guild, TextChannel, EmbedBuilder, AuditLogEvent } from "discord.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

export async function getLoggingConfig(guildId: string): Promise<LoggingConfig> {
  const { data, error } = await supabase
    .from("logging_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
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

  return data;
}

export async function setLoggingConfig(config: LoggingConfig): Promise<void> {
  const { error } = await supabase
    .from("logging_config")
    .upsert(config);

  if (error) throw error;
}

export async function sendLog(
  guild: Guild,
  title: string,
  description: string,
  color: number = 0x5865F2,
  fields?: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  const config = await getLoggingConfig(guild.id);

  if (!config.enabled || !config.log_channel_id) return;

  const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields) {
    embed.addFields(fields);
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to send log:", error);
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

  const channel = guild.channels.cache.get(config.log_channel_id) as TextChannel;
  if (!channel) return;

  const executor = await guild.members.fetch(executorId).catch(() => null);
  const executorName = executor ? executor.user.tag : "Unknown";

  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle(`📋 Audit Log: ${eventType}`)
    .setDescription(`**Executor:** ${executorName}\n**Target ID:** ${targetId}`)
    .addFields(changes.map(change => ({ name: "Change", value: change, inline: false })))
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to send audit log:", error);
  }
}
