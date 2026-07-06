/**
 * Global configuration & tunables (L-04).
 *
 * Magic numbers were previously scattered across the codebase
 * (MAX_TICKETS_PER_USER, EMOJI_LIMIT, MENTION_LIMIT, daily base amount, etc.).
 * They are centralised here with sensible defaults; per-guild overrides live
 * in the `guild_settings` table and are read at runtime by each system.
 *
 * NOTE: env vars are validated centrally in src/lib/env.ts; this file only
 * derives the role arrays from the already-validated env for convenience.
 */
export const prefix = "!";

// Role / owner configuration derived from env (see src/lib/env.ts for validation).
function csv(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const owners = csv("OWNER_IDS");
export const modRoles = csv("MOD_ROLE_IDS");
export const adminRoles = csv("ADMIN_ROLE_IDS");
export const supportRoles = csv("SUPPORT_ROLE_IDS");

// ── Tunables (defaults) ────────────────────────────────────────────────────
export const MAX_TICKETS_PER_USER = 3;

// AutoMod tunables (also overridable per-guild via DB config where applicable)
export const AUTOMOD = {
  SPAM_WINDOW_MS: 5000,
  SPAM_LIMIT: 5,
  CAPS_MIN_LENGTH: 10,
  CAPS_RATIO: 0.7,
  EMOJI_LIMIT: 8,
  MENTION_LIMIT: 5,
  /** A violation count is decayed (reset) after this much inactivity. */
  VIOLATION_DECAY_MS: 60 * 60 * 1000, // 1 hour
  /** Thresholds for the auto-punishment ladder. */
  PUNISH: { WARN: 2, MUTE: 3, KICK: 5 },
  MUTE_DURATION_MS: 10 * 60 * 1000,
} as const;

// Economy tunables
export const ECONOMY = {
  DAILY_BASE: 100,
  DAILY_STREAK_BONUS_PER_DAY: 10,
  DAILY_STREAK_BONUS_MAX: 100,
  DEFAULT_COOLDOWN_MS: 3000,
} as const;

// Captcha tunables
export const CAPTCHA = {
  DEFAULT_TIMEOUT_MS: 5 * 60 * 1000,
} as const;
