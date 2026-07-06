/**
 * Free Fire Community API client — redesigned.
 *
 *   Docs: https://docs.freefirecommunity.com
 *   Repo: https://github.com/ashqking/Free-Fire-API
 *
 * Quota (very tight — every request is valuable):
 *   • 100 requests / hour  (free tier)
 *   • 10 requests / minute (rate-limit)
 *
 * Auth: `x-api-key` header. The API also REJECTS requests whose User-Agent
 * contains library names (axios, node-fetch, python, …) — it returns 403 with
 * code FW_002 and a hint to set a custom UA. We always send a custom UA.
 *
 * Design:
 *  • ONE upstream call — `getPlayerInfo(uid, region)` → GET /info — returns the
 *    COMPLETE raw JSON. The cache layer stores it verbatim; all subcommands
 *    read from the cache, never from the API.
 *  • Every call is logged to `freefire_api_usage` (endpoint, uid, status, ms,
 *    rate_limited flag) so quota usage is observable.
 *  • A pre-flight hourly-quota guard refuses the call when the free tier is
 *    already exhausted, so we never waste a request that will 429.
 *  • `FreeFireError` carries a typed `kind` for actionable user messages.
 */
import { supabase } from "../../database/supabase.js";
import { log } from "../logger.js";

const BASE = "https://developers.freefirecommunity.com/api/v1";
const USER_AGENT = "cus_dis_bot/2.0 (+https://github.com/local/cus_dis_bot)";
const HOURLY_LIMIT = 100;

export type Region = "sg" | "ind" | "br";
export const REGIONS: Region[] = ["sg", "ind", "br"];

export class FreeFireError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "nokey" | "unauthorized" | "notfound" | "rate" | "quota" | "upstream" | "network"
  ) {
    super(message);
    this.name = "FreeFireError";
  }
}

function apiKey(): string | undefined {
  return process.env.FREEFIRE_API_KEY;
}

/** Count of API calls in the last hour (from freefire_api_usage). */
async function callsLastHour(): Promise<number> {
  const { data, error } = await supabase.rpc("freefire_api_usage_last_hour");
  if (error) return 0; // fail open — don't block on a logging error
  return typeof data === "number" ? data : 0;
}

async function recordUsage(p: {
  endpoint: string;
  uid?: string;
  region?: string;
  status: number;
  ms: number;
  rateLimited?: boolean;
  error?: string;
}): Promise<void> {
  try {
    await supabase.from("freefire_api_usage").insert({
      endpoint: p.endpoint,
      uid: p.uid ?? null,
      region: p.region ?? null,
      response_status: p.status,
      response_time_ms: p.ms,
      rate_limited: Boolean(p.rateLimited),
      error_message: p.error ?? null,
    });
  } catch (e: any) {
    log.warn("failed to record freefire api usage", { error: e?.message });
  }
}

/**
 * Fetch the complete player info JSON for a UID+region.
 * Returns the raw API response (stored verbatim by the cache layer).
 */
export async function fetchPlayerInfoRaw(uid: string, region: Region): Promise<any> {
  const key = apiKey();
  if (!key) {
    throw new FreeFireError(
      "No Free Fire API key configured. Get a free key at https://developers.freefirecommunity.com and set FREEFIRE_API_KEY in your .env file.",
      0,
      "nokey"
    );
  }

  // Pre-flight hourly quota guard (don't waste a request that will 429).
  const used = await callsLastHour();
  if (used >= HOURLY_LIMIT) {
    await recordUsage({ endpoint: "/info", uid, region, status: 0, ms: 0, rateLimited: true, error: "hourly quota guard" });
    throw new FreeFireError(
      `Free Fire hourly quota exhausted (${used}/${HOURLY_LIMIT}). Try again later — caches refresh every hour.`,
      0,
      "quota"
    );
  }

  const url = new URL(`${BASE}/info`);
  url.searchParams.set("region", region);
  url.searchParams.set("uid", uid);

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "x-api-key": key,
        "User-Agent": USER_AGENT,
      },
    });
  } catch (err: any) {
    const ms = Date.now() - started;
    await recordUsage({ endpoint: "/info", uid, region, status: 0, ms, error: `network: ${err?.message ?? err}` });
    throw new FreeFireError(`Network error contacting Free Fire API: ${err?.message ?? err}`, 0, "network");
  }
  const ms = Date.now() - started;

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    await recordUsage({ endpoint: "/info", uid, region, status: res.status, ms, error: body.slice(0, 200) });
    throw new FreeFireError(
      "Free Fire API rejected the request (401/403). Check FREEFIRE_API_KEY, and ensure no library name appears in your User-Agent.",
      res.status,
      "unauthorized"
    );
  }
  if (res.status === 404) {
    await recordUsage({ endpoint: "/info", uid, region, status: 404, ms });
    throw new FreeFireError("Player not found. Check the UID and region.", 404, "notfound");
  }
  if (res.status === 429) {
    await recordUsage({ endpoint: "/info", uid, region, status: 429, ms, rateLimited: true });
    throw new FreeFireError("Free Fire API rate limit hit (10/min, 100/hour free tier). Try again shortly.", 429, "rate");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await recordUsage({ endpoint: "/info", uid, region, status: res.status, ms, error: body.slice(0, 200) });
    throw new FreeFireError(`Free Fire API error ${res.status}: ${body.slice(0, 200)}`, res.status, "upstream");
  }

  let data: any;
  try {
    data = await res.json();
  } catch (err: any) {
    await recordUsage({ endpoint: "/info", uid, region, status: res.status, ms, error: `non-json: ${err?.message}` });
    throw new FreeFireError(`Free Fire API returned non-JSON: ${err?.message ?? err}`, res.status, "upstream");
  }

  await recordUsage({ endpoint: "/info", uid, region, status: res.status, ms });
  return data;
}
