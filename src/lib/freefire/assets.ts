/**
 * Asset Service — converts raw Free Fire asset IDs into names + images.
 *
 * The API returns numeric IDs for cosmetics (headPic, bannerId, title,
 * avatarId, weaponSkinShows, petId, …). These are meaningless to users.
 * This service resolves them via the `freefire_assets` catalogue table.
 *
 * Two-level cache (per the redesign brief):
 *   • In-memory TTL cache (assets rarely change → long TTL, e.g. 1h)
 *   • `freefire_assets` table (source of truth)
 *
 * Unknown assets:
 *   • Return the raw numeric ID as the name (so the UI never breaks).
 *   • Log the missing ID once per boot so an admin can add it later.
 *
 * Asset type taxonomy (used by getAvatar/getBanner/getPet/getWeapon/…):
 *   avatar | headpic | banner | title | badge | pin | pet | pet_skin |
 *   weapon_skin | outfit | skill | emote | vehicle | loot_box | other
 */
import { supabase } from "../../database/supabase.js";
import { log } from "../logger.js";

export type AssetType =
  | "avatar"
  | "headpic"
  | "banner"
  | "title"
  | "badge"
  | "pin"
  | "pet"
  | "pet_skin"
  | "weapon_skin"
  | "outfit"
  | "skill"
  | "emote"
  | "vehicle"
  | "loot_box"
  | "other";

export interface Asset {
  assetId: string;
  assetType: AssetType;
  name: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  rarity: string | null;
  metadata: Record<string, unknown>;
  found: boolean; // false when the ID was not in the catalogue (raw-ID fallback)
}

const MEM_TTL_MS = 60 * 60 * 1000; // 1 hour in-memory cache
const memCache = new Map<string, { asset: Asset; expires: number }>();
const reportedUnknown = new Set<string>(); // dedupe "unknown asset" logs per boot

/** CDN base for Free Fire asset images (best-effort; overridden by DB rows). */
const FF_CDN = "https://cdnd.freefiremobile.com";

function cdnUrl(assetId: string): string | null {
  if (!assetId || !/^\d+$/.test(assetId)) return null;
  // Common path pattern used by the community; real URLs come from the DB.
  return `${FF_CDN}/${assetId}.png`;
}

function emptyAsset(assetId: string, type: AssetType): Asset {
  return {
    assetId,
    assetType: type,
    name: assetId, // fallback: show the raw ID
    imageUrl: cdnUrl(assetId),
    thumbnailUrl: cdnUrl(assetId),
    rarity: null,
    metadata: {},
    found: false,
  };
}

async function loadFromDb(assetId: string, type: AssetType): Promise<Asset | null> {
  const { data, error } = await supabase
    .from("freefire_assets")
    .select("asset_id, asset_type, asset_name, image_url, thumbnail_url, rarity, metadata")
    .eq("asset_id", assetId)
    .eq("asset_type", type)
    .maybeSingle();

  if (error) {
    log.warn("freefire asset lookup failed", { error: error.message, assetId, type });
    return null;
  }
  if (!data) return null;

  return {
    assetId: data.asset_id,
    assetType: data.asset_type as AssetType,
    name: data.asset_name ?? assetId,
    imageUrl: data.image_url ?? cdnUrl(assetId),
    thumbnailUrl: data.thumbnail_url ?? data.image_url ?? cdnUrl(assetId),
    rarity: data.rarity,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    found: true,
  };
}

/**
 * Resolve a single asset. Goes through the in-memory cache → DB → raw-ID fallback.
 */
export async function getAsset(assetId: string | number | null | undefined, type: AssetType): Promise<Asset> {
  const id = assetId == null ? "" : String(assetId).trim();
  if (!id) return emptyAsset("", type);

  const key = `${type}:${id}`;
  const hit = memCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.asset;

  let asset = await loadFromDb(id, type);
  if (!asset) {
    asset = emptyAsset(id, type);
    if (!reportedUnknown.has(key)) {
      reportedUnknown.add(key);
      log.info("unknown freefire asset (add to freefire_assets)", { assetId: id, type });
    }
  }

  memCache.set(key, { asset, expires: Date.now() + MEM_TTL_MS });
  return asset;
}

// ── Typed convenience accessors (the ONLY API commands should use) ──────────
export const getAvatar = (id: string | number | null | undefined) => getAsset(id, "avatar");
export const getHeadPic = (id: string | number | null | undefined) => getAsset(id, "headpic");
export const getBanner = (id: string | number | null | undefined) => getAsset(id, "banner");
export const getTitle = (id: string | number | null | undefined) => getAsset(id, "title");
export const getBadge = (id: string | number | null | undefined) => getAsset(id, "badge");
export const getPin = (id: string | number | null | undefined) => getAsset(id, "pin");
export const getPet = (id: string | number | null | undefined) => getAsset(id, "pet");
export const getPetSkin = (id: string | number | null | undefined) => getAsset(id, "pet_skin");
export const getWeapon = (id: string | number | null | undefined) => getAsset(id, "weapon_skin");
export const getOutfit = (id: string | number | null | undefined) => getAsset(id, "outfit");
export const getSkill = (id: string | number | null | undefined) => getAsset(id, "skill");
export const getEmote = (id: string | number | null | undefined) => getAsset(id, "emote");
export const getVehicle = (id: string | number | null | undefined) => getAsset(id, "vehicle");

/** Resolve a list of asset IDs (e.g. weaponSkinShows) in parallel. */
export async function getAssets(ids: Array<string | number | null | undefined>, type: AssetType): Promise<Asset[]> {
  return Promise.all(ids.filter((x) => x != null && String(x).trim() !== "").map((id) => getAsset(id, type)));
}

/** Bust the in-memory asset cache (call after bulk-inserting new assets). */
export function invalidateAssetCache(): void {
  memCache.clear();
  reportedUnknown.clear();
}

/** Bulk upsert assets (used by the asset-update tooling). */
export async function upsertAssets(rows: Array<{
  asset_id: string;
  asset_type: AssetType;
  asset_name?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  rarity?: string | null;
  game_version?: string | null;
  metadata?: Record<string, unknown>;
}>): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from("freefire_assets")
    .upsert(rows.map((r) => ({
      asset_id: r.asset_id,
      asset_type: r.asset_type,
      asset_name: r.asset_name ?? null,
      image_url: r.image_url ?? null,
      thumbnail_url: r.thumbnail_url ?? null,
      rarity: r.rarity ?? null,
      game_version: r.game_version ?? null,
      metadata: r.metadata ?? {},
    })), { onConflict: "asset_id,asset_type" });
  if (error) {
    log.error("freefire asset bulk upsert failed", { error: error.message });
    throw error;
  }
  invalidateAssetCache();
  return rows.length;
}
