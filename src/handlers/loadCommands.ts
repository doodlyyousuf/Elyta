/**
 * Command loader — corrected (C-04, L-01, L-03).
 *
 *  • C-04  Previously only `['moderation','utility','tickets','giveaways',
 *          'smp','roles']` were scanned, so `admin/`, `gaming/`, and `music/`
 *          commands were never loaded or registered. Now ALL subdirectories of
 *          `src/commands` are discovered dynamically, with a startup log of
 *          loaded-vs-expected counts to catch this class of bug in future.
 *  • L-01  `client.commands` is typed (Collection<string, Command>) via the
 *          Client augmentation in src/types/index.d.ts — no more
 *          `(client as any).commands`.
 *  • L-03  Uses the structured logger.
 */
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { client } from "../client.js";
import type { Command } from "../types/index.js";
import { log } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Canonical, typed collection (single source of truth). */
export const commands = client.commands;

export async function loadCommands(): Promise<void> {
  commands.clear();

  const commandsRoot = join(__dirname, "../commands");
  let folders: string[];
  try {
    folders = readdirSync(commandsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (err: any) {
    log.error("commands directory not found", { error: err?.message, path: commandsRoot });
    return;
  }

  let loaded = 0;
  let skipped = 0;

  for (const folder of folders) {
    const folderPath = join(commandsRoot, folder);
    let files: string[];
    try {
      files = readdirSync(folderPath).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const mod = await import(`../commands/${folder}/${file}`);
        const cmd = mod.default ?? mod;
        if (cmd?.data && typeof cmd.execute === "function") {
          commands.set(cmd.data.name, cmd as Command);
          loaded++;
          log.debug("loaded command", { name: cmd.data.name, folder });
        } else {
          skipped++;
          log.warn("command module missing data/execute", { file: `${folder}/${file}` });
        }
      } catch (err: any) {
        skipped++;
        log.error("failed to load command", { file: `${folder}/${file}`, error: err?.message });
      }
    }
  }

  log.info("Commands loaded", { loaded, skipped, folders: folders.length });
}
