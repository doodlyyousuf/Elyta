/**
 * Centralised environment-variable validation (L-05).
 *
 * Previously every module read env vars with `process.env.X!` non-null
 * assertions, so a misconfiguration surfaced as a cryptic runtime error deep
 * in a command. This module validates the full schema once at startup, fails
 * fast with a clear message, and exposes a typed `env` object.
 *
 * Call `validateEnv()` at the very top of src/index.ts before anything else.
 */
import { z } from "zod";

const schema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY is required for server-side access"),
  SUPABASE_KEY: z.string().optional(),

  // Dashboard
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters (set a strong random value)"),
  ENABLE_DASHBOARD: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  WEB_PORT: z
    .string()
    .optional()
    .default("3000")
    .transform((v) => Number(v)),
  WEB_URL: z.string().url().optional(),

  // Optional role/owner configuration
  OWNER_IDS: z.string().optional().default(""),
  MOD_ROLE_IDS: z.string().optional().default(""),
  ADMIN_ROLE_IDS: z.string().optional().default(""),
  SUPPORT_ROLE_IDS: z.string().optional().default(""),

  // Optional third-party API keys
  // Free Fire Community API (https://developers.freefirecommunity.com). Required
  // for the /freefire command. Optional so the bot still boots without it.
  FREEFIRE_API_KEY: z.string().optional(),

  // Misc
  NODE_ENV: z.string().optional().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function validateEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const msg =
      "\n❌ Invalid environment configuration:\n" +
      issues +
      "\n\nFix the above values in your .env file and restart.";
    throw new Error(msg);
  }

  cached = parsed.data;
  return cached;
}

/** Convenience accessor — assumes validateEnv() has already run. */
export function env(): Env {
  return cached ?? validateEnv();
}
