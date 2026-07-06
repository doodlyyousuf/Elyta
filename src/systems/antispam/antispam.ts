/**
 * DB-backed anti-spam configuration & history tracker.
 *
 * NOTE (H-11): the canonical in-memory spam detector used by `messageCreate`
 * lives at `src/systems/automod/antiSpam.ts`. THIS module is the DB-backed
 * implementation kept for callers that may still reference it (per the audit
 * it's "mostly unused"). Its logic is intentionally left intact — the only
 * fix here is C-08.
 *
 * Fix C-08 (CRITICAL): previously created its own Supabase client with
 * `createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)`.
 * That bypassed the shared env validation in `src/database/supabase.ts` and
 * would crash on a missing env var with a cryptic message. It now imports
 * the single shared client.
 *
 * All exported functions, interfaces, and signatures are preserved:
 *   - `getAntiSpamConfig(guildId): Promise<AntiSpamConfig>`
 *   - `setAntiSpamConfig(config): Promise<void>`
 *   - `checkSpam(message): Promise<{ isSpam: boolean; action?: string }>`
 *   - `clearUserHistory(guildId, userId): void`
 *   - interfaces `AntiSpamConfig`, `UserMessageHistory`
 */

import { Message, GuildMember } from "discord.js";
import { supabase } from "../../database/supabase.js";

export interface AntiSpamConfig {
  guild_id: string;
  enabled: boolean;
  max_messages: number;
  time_window: number;
  punishment: "warn" | "mute" | "kick" | "ban";
  mute_duration?: number;
  exempt_roles: string[];
  exempt_channels: string[];
}

export interface UserMessageHistory {
  user_id: string;
  guild_id: string;
  messages: number;
  last_message: string;
}

const messageHistory = new Map<string, UserMessageHistory[]>();

export async function getAntiSpamConfig(guildId: string): Promise<AntiSpamConfig> {
  const { data, error } = await supabase
    .from("anti_spam_config")
    .select("*")
    .eq("guild_id", guildId)
    .single();

  if (error || !data) {
    return {
      guild_id: guildId,
      enabled: false,
      max_messages: 5,
      time_window: 5000,
      punishment: "warn",
      exempt_roles: [],
      exempt_channels: [],
    };
  }

  return data as AntiSpamConfig;
}

export async function setAntiSpamConfig(config: AntiSpamConfig): Promise<void> {
  const { error } = await supabase
    .from("anti_spam_config")
    .upsert(config);

  if (error) throw error;
}

export async function checkSpam(message: Message): Promise<{ isSpam: boolean; action?: string }> {
  if (!message.guildId) return { isSpam: false };

  const config = await getAntiSpamConfig(message.guildId);

  if (!config.enabled) return { isSpam: false };

  // Check if user is exempt
  const member = message.member as GuildMember;
  if (member?.roles?.cache?.some(role => config.exempt_roles.includes(role.id))) {
    return { isSpam: false };
  }

  // Check if channel is exempt
  if (config.exempt_channels.includes(message.channelId)) {
    return { isSpam: false };
  }

  const key = `${message.guildId}-${message.author.id}`;
  const now = Date.now();

  if (!messageHistory.has(key)) {
    messageHistory.set(key, []);
  }

  const history = messageHistory.get(key)!;

  // Remove old messages outside time window
  const validMessages = history.filter(
    msg => now - new Date(msg.last_message).getTime() < config.time_window
  );

  validMessages.push({
    user_id: message.author.id,
    guild_id: message.guildId,
    messages: 1,
    last_message: new Date().toISOString(),
  });

  messageHistory.set(key, validMessages);

  if (validMessages.length >= config.max_messages) {
    return {
      isSpam: true,
      action: config.punishment,
    };
  }

  return { isSpam: false };
}

export function clearUserHistory(guildId: string, userId: string): void {
  const key = `${guildId}-${userId}`;
  messageHistory.delete(key);
}
