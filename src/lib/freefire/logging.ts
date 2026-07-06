/**
 * Command logging — writes every /freefire execution to freefire_command_logs.
 *
 * Columns: user_id, guild_id, channel_id, uid, command_name, cache_hit,
 * api_called, execution_time_ms, success, error_message, created_at.
 *
 * Failures here are non-fatal: a logging error must never break a command.
 */
import { supabase } from "../../database/supabase.js";
import { log } from "../logger.js";

export interface CommandLogEntry {
  userId: string;
  guildId?: string | null;
  channelId?: string | null;
  uid?: string | null;
  commandName: string;
  cacheHit: boolean;
  apiCalled: boolean;
  executionTimeMs: number;
  success: boolean;
  errorMessage?: string | null;
}

export async function logCommand(entry: CommandLogEntry): Promise<void> {
  try {
    await supabase.from("freefire_command_logs").insert({
      user_id: entry.userId,
      guild_id: entry.guildId ?? null,
      channel_id: entry.channelId ?? null,
      uid: entry.uid ?? null,
      command_name: entry.commandName,
      cache_hit: entry.cacheHit,
      api_called: entry.apiCalled,
      execution_time_ms: Math.round(entry.executionTimeMs),
      success: entry.success,
      error_message: entry.errorMessage ?? null,
    });
  } catch (e: any) {
    log.warn("failed to log freefire command", { error: e?.message, command: entry.commandName });
  }
}
