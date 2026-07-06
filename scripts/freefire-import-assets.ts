/**
 * Free Fire asset seed/import script.
 *
 * Run with:  npx tsx scripts/freefire-import-assets.ts ./assets-ob57.json
 *
 * The JSON file can be either:
 *   • An array of asset rows:
 *       [{ "asset_id": "902051015", "asset_type": "headpic", "asset_name": "...",
 *          "image_url": "...", "rarity": "legendary", "game_version": "OB57",
 *          "metadata": {} }, ...]
 *   • An object keyed by asset type:
 *       { "headpic": [{ "id": "902051015", "name": "...", "image": "..." }, ...],
 *         "weapon_skin": [ ... ] }
 *
 * Unknown asset_type values are mapped to "other". Existing rows are upserted
 * (on conflict of asset_id+asset_type). The in-memory asset cache is busted
 * after import so new lookups see the new data immediately.
 *
 * Use this whenever a new Free Fire OB version drops (OB55/OB56/OB57/…) to
 * refresh the catalogue WITHOUT touching command code.
 */
import { readFile } from "node:fs/promises";
import { upsertAssets, type AssetType } from "../src/lib/freefire/assets.js";

const VALID: AssetType[] = [
  "avatar", "headpic", "banner", "title", "badge", "pin",
  "pet", "pet_skin", "weapon_skin", "outfit", "skill",
  "emote", "vehicle", "loot_box", "other",
];

function coerceType(t: string): AssetType {
  const lc = String(t || "").toLowerCase().replace(/[-\s]/g, "_");
  return (VALID as string[]).includes(lc) ? (lc as AssetType) : "other";
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/freefire-import-assets.ts <assets.json> [--version OB57]");
    process.exit(1);
  }
  const versionIdx = process.argv.indexOf("--version");
  const gameVersion = versionIdx >= 0 ? process.argv[versionIdx + 1] : undefined;

  const raw = JSON.parse(await readFile(file, "utf8"));

  let rows: Array<any> = [];
  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object") {
    for (const [type, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      for (const item of list as any[]) {
        rows.push({
          asset_type: type,
          asset_id: item.id ?? item.asset_id ?? item.assetId,
          asset_name: item.name ?? item.asset_name ?? item.assetName,
          image_url: item.image ?? item.image_url ?? item.imageUrl,
          thumbnail_url: item.thumbnail ?? item.thumbnail_url ?? item.thumbnailUrl,
          rarity: item.rarity,
          metadata: item.metadata ?? {},
        });
      }
    }
  } else {
    console.error("Input JSON must be an array or an object keyed by asset type.");
    process.exit(1);
  }

  const normalized = rows
    .filter((r) => r && (r.asset_id ?? r.id))
    .map((r) => ({
      asset_id: String(r.asset_id ?? r.id),
      asset_type: coerceType(r.asset_type ?? r.type ?? "other"),
      asset_name: r.asset_name ?? r.name ?? null,
      image_url: r.image_url ?? r.image ?? null,
      thumbnail_url: r.thumbnail_url ?? r.thumbnail ?? r.image_url ?? r.image ?? null,
      rarity: r.rarity ?? null,
      game_version: r.game_version ?? gameVersion ?? null,
      metadata: r.metadata ?? {},
    }));

  if (normalized.length === 0) {
    console.error("No valid asset rows found in the input file.");
    process.exit(1);
  }

  const n = await upsertAssets(normalized);
  console.log(`✅ Imported ${n} assets (version=${gameVersion ?? "unchanged"}).`);
}

main().catch((e) => {
  console.error("Asset import failed:", e);
  process.exit(1);
});
