/**
 * The ONE ready handler (C-09).
 *
 * Previously `loadEvents()` registered this file (once:true) AND `index.ts`
 * registered its own `client.once("ready")` — so invite caching ran twice and
 * `checkActiveGiveaways` ran on BOTH a 30s and 60s interval (double
 * giveaway-end attempts, race conditions). Now ALL startup logic lives here,
 * and `index.ts` registers no ready handler of its own.
 */
import { ActivityType } from "discord.js";
import { client } from "../client.js";
import { cacheAllGuildInvites } from "../systems/invites/inviteTracker.js";
import { checkActiveGiveaways } from "../systems/giveaways/giveawayHelper.js";
import { checkExpiredTempRoles } from "../systems/roles/tempRoleManager.js";
import { checkScheduledAnnouncements } from "../systems/advanced/scheduler.js";
import { checkReminders } from "../systems/advanced/reminderChecker.js";
import { loadCommands } from "../handlers/loadCommands.js";
import { registerCommands } from "../handlers/registerCommands.js";
import { startDashboard } from "../dashboard/server.js";
import { expireStaleCaptchaSessions } from "../systems/captcha/captcha.js";
import { cleanupExpiredFreeFireCache } from "../lib/freefire/cleanup.js";
import { registerBackgroundTask } from "../lib/scheduler.js";
import { log } from "../lib/logger.js";
import { env } from "../lib/env.js";

export default {
  // discord.js 14.16+ renamed `ready` → `clientReady` (the old name is
  // deprecated and will only emit under `clientReady` in v15). Both names work
  // in 14.16, but using `clientReady` silences the deprecation warning.
  name: "clientReady",
  once: true,
  async execute() {
    log.info("Bot ready", { tag: client.user?.tag ?? "unknown", guilds: client.guilds.cache.size });

    // Load & register slash commands (loadCommands now reads ALL folders — C-04).
    await loadCommands();
    if (client.user) {
      await registerCommands(client.user.id, process.env.DISCORD_TOKEN!);
    }

    // Cache invites for tracking (runs ONCE now, not twice).
    await cacheAllGuildInvites(client).catch((e: any) =>
      log.error("cacheAllGuildInvites failed", { error: e?.message })
    );

    // Run an initial pass of each background task, then schedule them on
    // isolated intervals (H-13): each task has its own try/catch + overlap
    // guard inside `registerBackgroundTask`, so one failure cannot block others.
    await checkActiveGiveaways(client).catch((e: any) =>
      log.error("checkActiveGiveaways failed", { error: e?.message })
    );
    await checkExpiredTempRoles(client).catch((e: any) =>
      log.error("checkExpiredTempRoles failed", { error: e?.message })
    );
    await checkScheduledAnnouncements(client).catch((e: any) =>
      log.error("checkScheduledAnnouncements failed", { error: e?.message })
    );
    await checkReminders(client).catch((e: any) =>
      log.error("checkReminders failed", { error: e?.message })
    );
    await expireStaleCaptchaSessions(client).catch((e: any) =>
      log.error("expireStaleCaptchaSessions failed", { error: e?.message })
    );

    registerBackgroundTask("giveaways", () => checkActiveGiveaways(client), 30_000);
    registerBackgroundTask("tempRoles", () => checkExpiredTempRoles(client), 60_000);
    registerBackgroundTask("scheduler", () => checkScheduledAnnouncements(client), 60_000);
    registerBackgroundTask("reminders", () => checkReminders(client), 30_000);
    registerBackgroundTask("captcha-expiry", () => expireStaleCaptchaSessions(client), 30_000);
    // Free Fire: purge expired player caches every 5 minutes.
    registerBackgroundTask("ff-cache-cleanup", () => cleanupExpiredFreeFireCache(), 5 * 60_000);

    // Start the dashboard (if enabled) after the bot is connected.
    if (env().ENABLE_DASHBOARD) {
      try {
        startDashboard();
      } catch (e: any) {
        log.error("Dashboard failed to start", { error: e?.message });
      }
    }

    client.user?.setPresence({
      activities: [{ name: "with tickets | /help", type: ActivityType.Playing }],
      status: "online",
    });
  },
};
