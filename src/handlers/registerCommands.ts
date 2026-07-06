/**
 * Slash-command registration — corrected (H-15).
 *
 * Previously the full command list was PUT to `Routes.applicationCommands`
 * (global) on every ready. Global commands take up to 1h to propagate and the
 * endpoint is rate-limited, so repeated PUTs risk 429s and slow dev updates.
 *
 * Now:
 *  • In development (NODE_ENV !== "production"), commands are registered as
 *    GUILD commands for the configured DEV_GUILD_ID (instant propagation).
 *  • In production, global commands are used, but the payload is diffed
 *    against the already-registered set and the PUT is skipped when nothing
 *    changed.
 */
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { commands } from "./loadCommands.js";
import { log } from "../lib/logger.js";

function shallowEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function registerCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const devGuildId = process.env.DEV_GUILD_ID;
  const isProd = process.env.NODE_ENV === "production";

  try {
    if (!isProd && devGuildId) {
      // Guild commands propagate instantly — ideal for development.
      log.info("Registering guild commands (dev)", { count: body.length, guild: devGuildId });

      // Diff against existing guild commands to avoid unnecessary PUTs.
      const existing = (await rest.get(
        Routes.applicationGuildCommands(clientId, devGuildId)
      )) as any[];
      const existingMap = new Map(existing.map((c) => [c.name, c]));
      const changed =
        existing.length !== body.length ||
        body.some((c) => {
          const ex = existingMap.get(c.name);
          return !ex || !shallowEqual(c, ex);
        });

      if (!changed) {
        log.info("Guild commands unchanged — skipping PUT", { count: body.length });
        return;
      }

      await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body });
      log.info("Guild commands registered", { count: body.length });
    } else {
      // Production: global commands, diffed to skip redundant PUTs.
      log.info("Registering global commands", { count: body.length });
      const existing = (await rest.get(Routes.applicationCommands(clientId))) as any[];
      const existingMap = new Map(existing.map((c) => [c.name, c]));
      const changed =
        existing.length !== body.length ||
        body.some((c) => {
          const ex = existingMap.get(c.name);
          return !ex || !shallowEqual(c, ex);
        });

      if (!changed) {
        log.info("Global commands unchanged — skipping PUT", { count: body.length });
        return;
      }

      await rest.put(Routes.applicationCommands(clientId), { body });
      log.info("Global commands registered", { count: body.length });
    }
  } catch (err: any) {
    log.error("Failed to register commands", { error: err?.message });
  }
}
