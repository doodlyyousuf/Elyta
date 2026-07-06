/**
 * Field extractors — read typed views out of the cached raw API response.
 *
 * Shape is based on the REAL /info response (confirmed against a live sample):
 *
 *   basicInfo:       { accountId, nickname, level, exp(string), liked, rank,
 *                      rankingPoints, maxRank, csRank, csRankingPoints, csMaxRank,
 *                      badgeCnt, badgeId, bannerId, headPic, pinId, title,
 *                      weaponSkinShows[], region, createAt(epoch-s string),
 *                      lastLoginAt(epoch-s string), releaseVersion, seasonId, … }
 *   captainBasicInfo: same shape as basicInfo (the guild captain)
 *   clanBasicInfo:    { clanId, clanName, clanLevel, memberNum, capacity, captainId }
 *   creditScoreInfo:  { creditScore, rewardState, rewardType, … }
 *   petInfo:          { id, skinId, selectedSkillId, level, exp, isSelected }
 *   profileInfo:      { avatarId, clothes[], equipedSkills[], isSelected, … }
 *   socialInfo:       { accountId, signature }
 *
 * These functions NEVER call the API and NEVER touch the DB (except via the
 * Asset Service, which is DB-backed but cached). One cached response satisfies
 * every subcommand.
 */
import type { Region } from "./api.js";

type Any = Record<string, any>;

function pick(obj: any, ...paths: string[]): unknown {
  if (obj == null) return undefined;
  for (const p of paths) {
    const v = p.split(".").reduce<any>((acc, k) => (acc == null ? undefined : acc[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
function str(obj: any, ...paths: string[]): string | undefined {
  const v = pick(obj, ...paths);
  return v == null ? undefined : String(v);
}
function num(obj: any, ...paths: string[]): number | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return undefined;
  const n = Number(v); // handles exp as string "1740731"
  return Number.isFinite(n) ? n : undefined;
}
function bool(obj: any, ...paths: string[]): boolean | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "true" || v === "1";
  return undefined;
}
function arr(obj: any, ...paths: string[]): any[] | undefined {
  const v = pick(obj, ...paths);
  return Array.isArray(v) ? v : undefined;
}
function assetId(obj: any, ...paths: string[]): string | undefined {
  const v = pick(obj, ...paths);
  if (v == null || v === "") return undefined;
  return String(v).trim() || undefined;
}

// ── PlayerBasic (from basicInfo) ────────────────────────────────────────────
export interface PlayerBasic {
  uid: string;
  region: Region | string;
  accountId?: string;
  nickname?: string;
  level?: number;
  exp?: number;
  liked?: number;
  // BR rank
  rank?: number; // tier code, e.g. 321
  maxRank?: number;
  rankingPoints?: number;
  // CS rank
  csRank?: number;
  csMaxRank?: number;
  csRankingPoints?: number;
  // cosmetics (asset IDs)
  headPicId?: string;
  bannerId?: string;
  titleId?: string;
  badgeId?: string;
  pinId?: string;
  avatarId?: string;
  badgeCount?: number;
  // meta
  releaseVersion?: string;
  seasonId?: number;
  createAt?: string; // epoch-seconds string
  lastLoginAt?: string;
  signature?: string;
  primeLevel?: number;
  diamondCost?: number;
}

export function basic(raw: any, uid: string, region: Region | string): PlayerBasic {
  const b = (pick(raw, "basicInfo") ?? raw) as Any; // fall back to raw if un-nested
  return {
    uid,
    region: (str(b, "region") ?? String(region)) as Region | string,
    accountId: str(b, "accountId"),
    nickname: str(b, "nickname", "name"),
    level: num(b, "level"),
    exp: num(b, "exp"),
    liked: num(b, "liked"),
    rank: num(b, "rank"),
    maxRank: num(b, "maxRank"),
    rankingPoints: num(b, "rankingPoints"),
    csRank: num(b, "csRank"),
    csMaxRank: num(b, "csMaxRank"),
    csRankingPoints: num(b, "csRankingPoints"),
    headPicId: assetId(b, "headPic"),
    bannerId: assetId(b, "bannerId"),
    titleId: assetId(b, "title"),
    badgeId: assetId(b, "badgeId"),
    pinId: assetId(b, "pinId"),
    avatarId: assetId(raw, "profileInfo.avatarId", "avatarId"),
    badgeCount: num(b, "badgeCnt", "badgeCount"),
    releaseVersion: str(b, "releaseVersion"),
    seasonId: num(b, "seasonId"),
    createAt: str(b, "createAt"),
    lastLoginAt: str(b, "lastLoginAt"),
    signature: str(raw, "socialInfo.signature", "signature"),
    primeLevel: num(b, "primePrivilegeDetail.primeLevel", "primeLevel"),
    diamondCost: num(raw, "diamondCostRes.diamondCost", "diamondCost"),
  };
}

// ── GuildInfo (from clanBasicInfo) ──────────────────────────────────────────
export interface GuildInfo {
  name?: string;
  id?: string;
  level?: number;
  memberCount?: number;
  capacity?: number;
  captainId?: string;
  captainName?: string; // from captainBasicInfo.nickname
}
export function guild(raw: any): GuildInfo | null {
  const g = pick(raw, "clanBasicInfo", "clanInfo", "guild") as Any | undefined;
  if (!g) return null;
  const captain = pick(raw, "captainBasicInfo") as Any | undefined;
  return {
    name: str(g, "clanName", "name"),
    id: str(g, "clanId", "id"),
    level: num(g, "clanLevel", "level"),
    memberCount: num(g, "memberNum", "memberCount"),
    capacity: num(g, "capacity"),
    captainId: str(g, "captainId"),
    captainName: str(captain, "nickname"),
  };
}

// ── PetInfo (from petInfo) ──────────────────────────────────────────────────
export interface PetInfo {
  id?: string; // pet asset ID
  name?: string;
  level?: number;
  xp?: number;
  skinId?: string; // pet_skin asset ID
  selectedSkillId?: string;
  isSelected?: boolean;
}
export function pet(raw: any): PetInfo | null {
  const p = pick(raw, "petInfo", "pet") as Any | undefined;
  if (!p) return null;
  return {
    id: assetId(p, "id", "petId"),
    name: str(p, "name", "petName"),
    level: num(p, "level"),
    xp: num(p, "exp", "xp"),
    skinId: assetId(p, "skinId"),
    selectedSkillId: assetId(p, "selectedSkillId"),
    isSelected: bool(p, "isSelected"),
  };
}

// ── RankInfo (from basicInfo rank fields) ───────────────────────────────────
export interface RankInfo {
  brRank?: number; // tier code
  brMaxRank?: number;
  brPoints?: number;
  csRank?: number;
  csMaxRank?: number;
  csPoints?: number;
}
export function ranks(raw: any): RankInfo {
  const b = (pick(raw, "basicInfo") ?? raw) as Any;
  return {
    brRank: num(b, "rank"),
    brMaxRank: num(b, "maxRank"),
    brPoints: num(b, "rankingPoints"),
    csRank: num(b, "csRank"),
    csMaxRank: num(b, "csMaxRank"),
    csPoints: num(b, "csRankingPoints"),
  };
}

// ── Career stats (from basicInfo.selectOccupations — limited data) ──────────
// NOTE: the /info endpoint does NOT return full career stats (games/wins/kills).
// It returns `selectOccupations` (per-mode play-style breakdown). Full career
// stats would require the /stats endpoint (separate API call). We expose what's
// available so /freefire stats shows *something* from the cache without another
// API call.
export interface ModeStats {
  name: string;
  games?: number;
  wins?: number;
  kills?: number;
  headshots?: number;
  deaths?: number;
  topN?: number;
  damage?: number;
}
export function stats(raw: any): ModeStats[] {
  const occ = arr(raw, "basicInfo.selectOccupations", "selectOccupations");
  const out: ModeStats[] = [];
  if (occ) {
    for (const o of occ) {
      if (!o || typeof o !== "object") continue;
      const d = o.details ?? {};
      out.push({
        name: modeName(o.modeId),
        games: num(d, "key2"), // key2 ≈ matches played (community convention)
        wins: num(d, "key1"), // key1 ≈ wins/booyahs
        kills: num(d, "key3"), // key3 ≈ kills
        headshots: num(d, "key4"), // key4 ≈ headshot kills
        deaths: num(d, "key5"), // key5 ≈ deaths
      });
    }
  }
  return out;
}
function modeName(modeId?: number): string {
  switch (modeId) {
    case 1: return "BR";
    case 15: return "Clash Squad";
    default: return modeId ? `Mode ${modeId}` : "Unknown";
  }
}

// ── Honor / badges / credit ─────────────────────────────────────────────────
export interface HonorInfo {
  honorScore?: number; // creditScoreInfo.creditScore
  badges?: number; // basicInfo.badgeCnt
  badgeId?: string;
}
export function honor(raw: any): HonorInfo {
  return {
    honorScore: num(raw, "creditScoreInfo.creditScore", "creditScore"),
    badges: num(raw, "basicInfo.badgeCnt", "badgeCnt"),
    badgeId: assetId(raw, "basicInfo.badgeId", "badgeId"),
  };
}

// ── Weapon skins (from basicInfo.weaponSkinShows) ───────────────────────────
export interface WeaponSkin {
  id: string;
}
export function weaponSkins(raw: any): WeaponSkin[] {
  const ids = arr(raw, "basicInfo.weaponSkinShows", "weaponSkinShows");
  return (ids ?? [])
    .map((x: any) => (x == null ? undefined : String(x)))
    .filter((x: string | undefined): x is string => Boolean(x))
    .map((id) => ({ id }));
}

// ── Outfit / clothes (from profileInfo.clothes) ─────────────────────────────
export interface OutfitPiece {
  id: string;
}
export function outfit(raw: any): OutfitPiece[] {
  const ids = arr(raw, "profileInfo.clothes", "clothes");
  return (ids ?? [])
    .map((x: any) => (x == null ? undefined : String(x)))
    .filter((x: string | undefined): x is string => Boolean(x))
    .map((id) => ({ id }));
}

// ── Equipped skills (from profileInfo.equipedSkills) ────────────────────────
export interface EquippedSkill {
  id: string;
  slotId?: number;
}
export function equippedSkills(raw: any): EquippedSkill[] {
  const list = arr(raw, "profileInfo.equipedSkills", "equipedSkills");
  return (list ?? [])
    .map((s: any) => {
      if (!s) return undefined;
      const id = s.skillId ?? s.id;
      if (id == null) return undefined;
      return { id: String(id), slotId: typeof s.slotId === "number" ? s.slotId : undefined };
    })
    .filter((x): x is EquippedSkill => Boolean(x));
}

// ── Credit info ─────────────────────────────────────────────────────────────
export interface CreditInfo {
  creditScore?: number;
  rewardState?: number;
  rewardType?: number;
}
export function credit(raw: any): CreditInfo {
  const c = pick(raw, "creditScoreInfo") as Any | undefined;
  if (!c) return {};
  return {
    creditScore: num(c, "creditScore"),
    rewardState: num(c, "rewardState"),
    rewardType: num(c, "rewardType"),
  };
}

// ── Leaderboard (not in /info; returned only if present) ────────────────────
export interface LeaderboardEntry {
  rank?: number;
  uid?: string;
  name?: string;
  points?: number;
}
export function leaderboard(raw: any): LeaderboardEntry[] {
  const a = arr(raw, "leaderboard", "rankings");
  return (a ?? []).map((e: any) => ({
    rank: num(e, "rank", "position"),
    uid: str(e, "uid", "playerId"),
    name: str(e, "name", "nickname"),
    points: num(e, "points", "rankingPoints"),
  }));
}

// ── Captain info (from captainBasicInfo) ────────────────────────────────────
export function captain(raw: any): PlayerBasic | null {
  const c = pick(raw, "captainBasicInfo") as Any | undefined;
  if (!c) return null;
  return {
    uid: str(c, "accountId") ?? "",
    region: str(c, "region") ?? "",
    accountId: str(c, "accountId"),
    nickname: str(c, "nickname"),
    level: num(c, "level"),
    exp: num(c, "exp"),
    liked: num(c, "liked"),
    rank: num(c, "rank"),
    maxRank: num(c, "maxRank"),
    rankingPoints: num(c, "rankingPoints"),
    csRank: num(c, "csRank"),
    csMaxRank: num(c, "csMaxRank"),
    csRankingPoints: num(c, "csRankingPoints"),
    headPicId: assetId(c, "headPic"),
    bannerId: assetId(c, "bannerId"),
    titleId: assetId(c, "title"),
    badgeId: assetId(c, "badgeId"),
    pinId: assetId(c, "pinId"),
    badgeCount: num(c, "badgeCnt"),
    releaseVersion: str(c, "releaseVersion"),
    seasonId: num(c, "seasonId"),
    createAt: str(c, "createAt"),
    lastLoginAt: str(c, "lastLoginAt"),
  };
}

// ── Epoch-seconds string → readable date helper ─────────────────────────────
export function epochToDate(s?: string): Date | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const ms = n < 1e12 ? n * 1000 : n; // seconds vs milliseconds
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}
