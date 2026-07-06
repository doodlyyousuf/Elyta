/**
 * Single shared Supabase client for the entire bot (server-side only).
 *
 * Fixes C-08: previously 7 duplicate clients were created across the codebase,
 * some using the anon key (SUPABASE_KEY) for server-side writes (blocked by RLS)
 * and others using the service key (SUPABASE_SERVICE_KEY). All modules now import
 * this ONE client, which always uses the SERVICE key and validates env vars once
 * at startup with a clear error.
 *
 * Usage:
 *   import { supabase } from "../database/supabase.js";
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
// Prefer the service role key for server-side reads/writes (bypasses RLS).
// Fall back to SUPABASE_KEY only if a deploy genuinely has no service key, but
// warn loudly — anon-key server writes will be blocked by RLS policies.
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_KEY;

if (!url) {
  throw new Error(
    "[supabase] SUPABASE_URL is not set. Add it to your .env file."
  );
}

if (!serviceKey && !anonKey) {
  throw new Error(
    "[supabase] Neither SUPABASE_SERVICE_KEY nor SUPABASE_KEY is set. " +
      "For server-side usage you MUST set SUPABASE_SERVICE_KEY (the service role key, NOT the anon key)."
  );
}

if (!serviceKey && anonKey) {
  // Warn but do not crash — some legacy deploys may still rely on the anon key.
  console.warn(
    "⚠️ [supabase] SUPABASE_SERVICE_KEY is not set; falling back to SUPABASE_KEY (anon). " +
      "Server-side writes will be subject to Row-Level Security and may fail. " +
      "Set SUPABASE_SERVICE_KEY for correct server-side behaviour."
  );
}

const effectiveKey = serviceKey || anonKey!;

export const supabase: SupabaseClient = createClient(url, effectiveKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Whether the active client is using the service role key (bypasses RLS). */
export const usingServiceKey = Boolean(serviceKey);
