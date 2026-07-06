/**
 * Free Fire Community API client.
 *
 * Docs: https://docs.freefirecommunity.com
 * Repo: https://github.com/ashqking/Free-Fire-API
 *
 * Auth: `x-api-key` header (free key from https://developers.freefirecommunity.com).
 * Free tier: 100 requests/hour.
 *
 * Endpoints used here:
 *   GET /info      — player profile (nickname, level, rank, clan, pets, …)
 *   GET /stats     — career stats (games, wins, kills, headshots, …) per mode
 *   GET /bancheck  — ban status for a UID
 *
 * The API response shape is not strictly documented, so every accessor below
 * is defensive: it reads known fields but falls back to `undefined` rather than
 * throwing when the shape differs. Callers render whatever is present.
 */
import { log } from "./logger.js";

const BASE = "https://developers.freefirecommunity.com/api/v1";

export type Region = "sg" | "ind" | "br";
export const REGIONS: Region[] = ["sg", "ind", "br"];

export class FreeFireError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "nokey" | "unauthorized" | "notfound" | "rate" | "upstream" | "network"
  ) {
    super(message);
    this.name = "FreeFireError";
  }
}

function apiKey(): string | undefined {
  // Prefer the validated env, but fall back to raw process.env so the command
  // works even if validateEnv() hasn't run (e.g. in a quick test harness).
  return process.env.FREEFIRE_API_KEY;
}

async function ffGet<T = unknown>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new FreeFireError(
      "No Free Fire API key configured. Get a free key at https://developers.freefirecommunity.com and set FREEFIRE_API_KEY in your .env file.",
      0,
      "nokey"
    );
  }

  const url = new URL(`${BASE}/${endpoint.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { headers: { "x-api-key": key } });
  } catch (err: any) {
    throw new FreeFireError(`Network error contacting Free Fire API: ${err?.message ?? err}`, 0, "network");
  }

  if (res.status === 401 || res.status === 403) {
    throw new FreeFireError("Free Fire API rejected the API key (401/403). Check FREEFIRE_API_KEY.", res.status, "unauthorized");
  }
  if (res.status === 404) {
    throw new FreeFireError("Player not found. Check the UID and region.", res.status, "notfound");
  }
  if (res.status === 429) {
    throw new FreeFireError("Free Fire API rate limit hit (100 req/hour on the free tier). Try again later.", res.status, "rate");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FreeFireError(`Free Fire API error ${res.status}: ${body.slice(0, 200)}`, res.status, "upstream");
  }

  try {
    return (await res.json()) as T;
  } catch (err: any) {
    throw new FreeFireError(`Free Fire API returned non-JSON: ${err?.message ?? err}`, res.status, "upstream");
  }
}

// ── Safe accessors for the /info response ─────────────────────────────────
function pick(obj: any, path: string): unknown {
  return path.split(".").reduce((acc: any, k) => (acc == null ? undefined : acc[k]), obj);
}
function str(obj: any, path: string): string | undefined {
  const v = pick(obj, path);
  return v == null ? undefined : String(v);
}
function num(obj: any, path: string): number | undefined {
  const v = pick(obj, path);
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export interface PlayerInfo {
  raw: any;
  uid: string;
  region: string;
  nickname?: string;
  level?: number;
  exp?: number;
  rankedPoints?: number;
  accountId?: string;
  guildName?: string;
  guildId?: string;
  guildLevel?: number;
  guildMembers?: number;
  bioName?: string;
  bioDescription?: string;
  badges?: number;
  likes?: number;
  title?: string;
  createAt?: string;
  lastLoginAt?: string;
  // Normalised mode list for stats (populated by /stats, empty for /info)
  modes?: { name: string; games?: number; wins?: number; kills?: number; headshots?: number }[];
}

export async function getPlayerInfo(uid: string, region: Region): Promise<PlayerInfo> {
  const data: any = await ffGet("info", { region, uid });
  log.debug("freefire /info response", { uid, region, keys: Object.keys(data ?? {}) });
  return {
    raw: data,
    uid,
    region,
    nickname: str(data, "basic.name") ?? str(data, "basic.nickname") ?? str(data, "accountInfo.nickname") ?? str(data, "nickname"),
    level: num(data, "basic.level") ?? num(data, "level"),
    exp: num(data, "basic.exp") ?? num(data, "exp"),
    rankedPoints: num(data, "basic.rankedPoints") ?? num(data, "rankedPoints") ?? num(data, "ranked"),
    accountId: str(data, "accountInfo.accountId") ?? str(data, "basic.accountId") ?? str(data, "accountId"),
    guildName: str(data, "clanGuildInfo.guildName") ?? str(data, "clanGuildInfo.name") ?? str(data, "guild.name"),
    guildId: str(data, "clanGuildInfo.guildId") ?? str(data, "clanGuildInfo.id") ?? str(data, "guild.id"),
    guildLevel: num(data, "clanGuildInfo.level") ?? num(data, "guild.level"),
    guildMembers: num(data, "clanGuildInfo.memberNum") ?? num(data, "clanGuildInfo.memberCount") ?? num(data, "guild.members"),
    bioName: str(data, "captainBio.name") ?? str(data, "captainBio.basicInfo.name"),
    bioDescription: str(data, "captainBio.description") ?? str(data, "captainBio.basicInfo.description"),
    badges: num(data, "badgeCount") ?? num(data, "badges"),
    likes: num(data, "basic.liked") ?? num(data, "liked") ?? num(data, "likes"),
    title: str(data, "basic.title") ?? str(data, "title"),
    createAt: str(data, "accountInfo.createAt") ?? str(data, "createdAt"),
    lastLoginAt: str(data, "accountInfo.lastLoginAt") ?? str(data, "lastLoginAt") ?? str(data, "lastLogin"),
  };
}

export interface PlayerStats {
  raw: any;
  uid: string;
  region: string;
  modes: { name: string; games?: number; wins?: number; kills?: number; headshots?: number; deaths?: number; topN?: number }[];
}

/**
 * /stats returns career stats per mode (solo/duo/squad). The exact key for the
 * mode list varies; we try a few known shapes and fall back to scanning the
 * top-level object for array-of-stat values.
 */
export async function getPlayerStats(uid: string, region: Region): Promise<PlayerStats> {
  const data: any = await ffGet("stats", { region, uid });
  log.debug("freefire /stats response", { uid, region, keys: Object.keys(data ?? {}) });

  const modes: PlayerStats["modes"] = [];

  // Shape 1: { solo: {...}, duo: {...}, squad: {...} }
  for (const k of ["solo", "duo", "squad", "clashSquad", "csranked"]) {
    const m = data?.[k];
    if (m && typeof m === "object") {
      modes.push({
        name: k,
        games: num(m, "games") ?? num(m, "matches"),
        wins: num(m, "wins") ?? num(m, "win"),
        kills: num(m, "kills"),
        headshots: num(m, "headshots") ?? num(m, "headShotCount"),
        deaths: num(m, "deaths"),
        topN: num(m, "topN") ?? num(m, "top10"),
      });
    }
  }

  // Shape 2: { stats: [ { mode: "solo", ... }, ... ] }
  if (Array.isArray(data?.stats)) {
    for (const m of data.stats) {
      if (m && typeof m === "object") {
        modes.push({
          name: str(m, "mode") ?? str(m, "name") ?? "mode",
          games: num(m, "games") ?? num(m, "matches"),
          wins: num(m, "wins") ?? num(m, "win"),
          kills: num(m, "kills"),
          headshots: num(m, "headshots") ?? num(m, "headShotCount"),
          deaths: num(m, "deaths"),
          topN: num(m, "topN") ?? num(m, "top10"),
        });
      }
    }
  }

  return { raw: data, uid, region, modes };
}

export interface BanStatus {
  raw: any;
  uid: string;
  banned: boolean;
  banPeriodText?: string;
  banStartText?: string;
  banEndText?: string;
}

export async function getBanCheck(uid: string, lang: string = "en"): Promise<BanStatus> {
  const data: any = await ffGet("bancheck", { uid, lang });
  log.debug("freefire /bancheck response", { uid, keys: Object.keys(data ?? {}) });

  // The API typically returns something like:
  //   { "isBanned": true, "banPeriod": 365, "banStart": "...", "banEnd": "..." }
  // but be defensive about the exact key names.
  const banned =
    pick(data, "isBanned") === true ||
    pick(data, "banned") === true ||
    pick(data, "banInfo.isBanned") === true ||
    String(pick(data, "status") ?? "").toLowerCase() === "banned";

  return {
    raw: data,
    uid,
    banned,
    banPeriodText: str(data, "banPeriodText") ?? str(data, "banPeriod"),
    banStartText: str(data, "banStartText") ?? str(data, "banStart"),
    banEndText: str(data, "banEndText") ?? str(data, "banEnd"),
  };
}
