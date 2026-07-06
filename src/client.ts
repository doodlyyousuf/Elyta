/**
 * Typed Discord client (L-01).
 *
 * Fixes L-01: `client.commands` was attached via `(client as any).commands`,
 * bypassing TypeScript. The Client interface is now augmented in
 * `src/types/index.d.ts` so `client.commands` is a typed Collection.
 */
import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import type { Command } from "./types/index.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildIntegrations,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

// Single, typed source of truth for loaded commands.
client.commands = new Collection<string, Command>();

// `client.distube` is assigned in src/index.ts after the DisTube instance is
// constructed (kept out of client.ts to avoid importing discord.js voice deps
// at module-eval time).
