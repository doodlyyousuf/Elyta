/**
 * Shared TypeScript types & Client augmentation (M-01, L-01).
 *
 * Previously `src/types/index.d.ts` was empty and every handler used
 * `interaction: any`, `member: any`, `message: any`, while commands were
 * attached to the client via `(client as any).commands`. This file fills in
 * the shared interfaces and augments the discord.js Client so `client.commands`
 * and `client.distube` are type-checked.
 */
import type { Collection } from "discord.js";
import type { SlashCommandBuilder } from "discord.js";
import type { DisTube } from "distube";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A registered slash command module. */
export interface Command {
  /** Slash command builder (the `data` export). */
  data: SlashCommandBuilder;
  /** Command execution handler. `client` is provided so music commands can read distube. */
  execute: (interaction: import("discord.js").ChatInputCommandInteraction, client?: import("discord.js").Client) => Promise<unknown> | unknown;
  /** Per-command cooldown in milliseconds. Defaults to 3000 when unset. */
  cooldownMs?: number;
  /** Whether replies should be ephemeral. Defaults to false (public). */
  ephemeral?: boolean;
}

/** Legacy dual-export compatibility (some files export { data, execute }). */
export type CommandModule = Command;

/** Shared per-guild config row used across logging/automod/etc. */
export interface GuildSettings {
  guild_id: string;
  autorole_id?: string | null;
  welcome_channel_id?: string | null;
  welcome_message?: string | null;
  leave_channel_id?: string | null;
  leave_message?: string | null;
  min_account_age_days?: number | null;
  log_channel_id?: string | null;
  archive_channel_id?: string | null;
  mod_log_channel_id?: string | null;
  [key: string]: unknown;
}

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
    distube?: DisTube;
  }
}
