/**
 * Embed builders — rich Discord embeds for each /freefire subcommand.
 *
 * Every image comes from the Asset Service (DB-backed + cached). Raw numeric
 * IDs are NEVER shown to the user when an image or name is available; if an
 * asset is unknown, the raw ID is shown as the name (fallback) and the missing
 * ID is logged once per boot.
 *
 * Field names match the REAL /info response (basicInfo.*, clanBasicInfo.*,
 * creditScoreInfo.*, petInfo.*, profileInfo.*, socialInfo.*).
 */
import { EmbedBuilder, type EmbedField } from "discord.js";
import {
  getHeadPic, getBanner, getTitle, getBadge, getPin,
  getPet, getPetSkin, getWeapon, getOutfit, getAssets, type Asset,
} from "./assets.js";
import { epochToDate, type PlayerBasic, type GuildInfo, type PetInfo, type RankInfo, type ModeStats, type HonorInfo, type WeaponSkin } from "./extract.js";

const ACCENT = 0xff5733;
const ACCENT_GREEN = 0x2ecc71;
const ACCENT_RED = 0xe74c3c;
const ACCENT_GOLD = 0xffd700;

function fv(v: unknown, fallback = "—"): string {
  if (v == null || v === "") return fallback;
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
function pct(n: number | undefined, d: number | undefined): string {
  if (!n || !d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}
function fmtEpoch(s?: string): string {
  const d = epochToDate(s);
  return d ? d.toUTCString() : "—";
}

function attachThumbnail(embed: EmbedBuilder, asset: Asset | undefined): void {
  if (asset?.thumbnailUrl) embed.setThumbnail(asset.thumbnailUrl);
}
function attachImage(embed: EmbedBuilder, asset: Asset | undefined): void {
  if (asset?.imageUrl) embed.setImage(asset.imageUrl);
}

/** Common header: thumbnail=headpic, image=banner, author=name, UID/region/level fields. */
async function header(b: PlayerBasic, title: string): Promise<EmbedBuilder> {
  const [headpic, banner] = await Promise.all([
    b.headPicId ? getHeadPic(b.headPicId).catch(() => undefined) : Promise.resolve(undefined),
    b.bannerId ? getBanner(b.bannerId).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(title)
    .addFields(
      { name: "UID", value: fv(b.uid), inline: true },
      { name: "Region", value: fv((b.region as string).toUpperCase()), inline: true },
      { name: "Level", value: fv(b.level), inline: true }
    )
    .setFooter({ text: "Data: Free Fire Community API · cached" })
    .setTimestamp();
  if (b.nickname) embed.setAuthor({ name: b.nickname });
  attachThumbnail(embed, headpic);
  attachImage(embed, banner);
  return embed;
}

// ── /freefire profile ───────────────────────────────────────────────────────
export async function buildProfileEmbed(b: PlayerBasic, g: GuildInfo | null, r: RankInfo, h: HonorInfo, p: PetInfo | null): Promise<EmbedBuilder> {
  const embed = await header(b, `🔥 ${b.nickname ?? `UID ${b.uid}`}`);
  const fields: EmbedField[] = [];

  if (b.liked != null) fields.push({ name: "Likes", value: fv(b.liked), inline: true });
  if (b.exp != null) fields.push({ name: "EXP", value: fv(b.exp), inline: true });
  if (b.badgeCount != null) fields.push({ name: "Badges", value: fv(b.badgeCount), inline: true });
  if (r.brPoints != null) fields.push({ name: "BR Points", value: fv(r.brPoints), inline: true });
  if (r.csPoints != null) fields.push({ name: "CS Points", value: fv(r.csPoints), inline: true });
  if (h.honorScore != null) fields.push({ name: "Honor Score", value: fv(h.honorScore), inline: true });

  // Title (asset ID → name)
  if (b.titleId) {
    const t = await getTitle(b.titleId).catch(() => undefined);
    fields.push({ name: "Title", value: t?.name ?? b.titleId, inline: true });
  }
  if (b.releaseVersion) fields.push({ name: "Version", value: fv(b.releaseVersion), inline: true });
  if (b.seasonId != null) fields.push({ name: "Season", value: fv(b.seasonId), inline: true });
  if (b.primeLevel != null) fields.push({ name: "Prime Level", value: fv(b.primeLevel), inline: true });
  if (b.diamondCost != null) fields.push({ name: "Diamond Cost", value: fv(b.diamondCost), inline: true });

  if (g?.name) {
    fields.push({ name: "Guild", value: `${g.name}${g.id ? ` (\`${g.id}\`)` : ""}`, inline: false });
  }

  if (fields.length) embed.addFields(fields);

  // Pet
  if (p?.id || p?.name) {
    const petAsset = p?.id ? await getPet(p.id).catch(() => undefined) : undefined;
    embed.addFields({ name: "Pet", value: petAsset?.name ?? p?.name ?? fv(p?.id), inline: true });
  }

  // Bio / signature
  if (b.signature) {
    embed.addFields({ name: "Signature", value: b.signature, inline: false });
  }

  // Dates
  if (b.createAt || b.lastLoginAt) {
    embed.addFields({
      name: "Dates",
      value: [b.createAt ? `Created: ${fmtEpoch(b.createAt)}` : "", b.lastLoginAt ? `Last login: ${fmtEpoch(b.lastLoginAt)}` : ""].filter(Boolean).join("\n") || "—",
      inline: false,
    });
  }
  return embed;
}

// ── /freefire stats ─────────────────────────────────────────────────────────
export async function buildStatsEmbed(b: PlayerBasic, modes: ModeStats[]): Promise<EmbedBuilder> {
  const embed = await header(b, `📊 Stats — ${b.nickname ?? b.uid}`);

  // NOTE: /info does not return full career stats; it returns selectOccupations
  // (per-mode play-style breakdown). Show what's available.
  if (modes.length === 0) {
    embed.setDescription("ℹ️ Detailed career stats (games/wins/kills) require the `/stats` API endpoint, which isn't cached. The player's rank points and badges are available via `/freefire rank` and `/freefire honor`.");
    return embed;
  }

  const totalGames = modes.reduce((a, m) => a + (m.games ?? 0), 0);
  const totalWins = modes.reduce((a, m) => a + (m.wins ?? 0), 0);
  const totalKills = modes.reduce((a, m) => a + (m.kills ?? 0), 0);

  embed.addFields(
    { name: "Total Games", value: fv(totalGames), inline: true },
    { name: "Total Wins", value: fv(totalWins), inline: true },
    { name: "Win Rate", value: pct(totalWins, totalGames), inline: true },
    { name: "Total Kills", value: fv(totalKills), inline: true },
    { name: "K/D", value: totalGames ? (totalKills / Math.max(totalGames - totalWins, 1)).toFixed(2) : "—", inline: true }
  );
  for (const m of modes.slice(0, 5)) {
    embed.addFields({
      name: m.name,
      value: [
        `Games: ${fv(m.games)}`,
        `Wins: ${fv(m.wins)} (${pct(m.wins, m.games)})`,
        `Kills: ${fv(m.kills)}`,
        `Headshots: ${fv(m.headshots)}`,
      ].join("\n"),
      inline: true,
    });
  }
  return embed;
}

// ── /freefire rank ──────────────────────────────────────────────────────────
export async function buildRankEmbed(b: PlayerBasic, r: RankInfo): Promise<EmbedBuilder> {
  const embed = await header(b, `🏆 Rank — ${b.nickname ?? b.uid}`);
  embed.addFields(
    { name: "BR Rank", value: fv(r.brRank), inline: true },
    { name: "BR Points", value: fv(r.brPoints), inline: true },
    { name: "BR Max Rank", value: fv(r.brMaxRank), inline: true },
    { name: "CS Rank", value: fv(r.csRank), inline: true },
    { name: "CS Points", value: fv(r.csPoints), inline: true },
    { name: "CS Max Rank", value: fv(r.csMaxRank), inline: true }
  );
  embed.addFields({
    name: "ℹ️ About ranks",
    value: "Rank numbers are tier codes from the API. Points are the competitive metric players recognise.",
    inline: false,
  });
  return embed;
}

// ── /freefire guild ─────────────────────────────────────────────────────────
export async function buildGuildEmbed(b: PlayerBasic, g: GuildInfo | null): Promise<EmbedBuilder> {
  const embed = await header(b, `🏢 Guild — ${b.nickname ?? b.uid}`);
  if (!g) {
    embed.setDescription("This player is not in a guild.");
    return embed;
  }
  embed.addFields(
    { name: "Name", value: fv(g.name), inline: true },
    { name: "ID", value: fv(g.id), inline: true },
    { name: "Level", value: fv(g.level), inline: true },
    { name: "Members", value: fv(g.memberCount), inline: true },
    { name: "Capacity", value: fv(g.capacity), inline: true },
    { name: "Captain", value: g.captainName ? `${g.captainName}${g.captainId ? ` (\`${g.captainId}\`)` : ""}` : fv(g.captainId), inline: true }
  );
  return embed;
}

// ── /freefire pet ───────────────────────────────────────────────────────────
export async function buildPetEmbed(b: PlayerBasic, p: PetInfo | null): Promise<EmbedBuilder> {
  const embed = await header(b, `🐾 Pet — ${b.nickname ?? b.uid}`);
  if (!p) {
    embed.setDescription("This player has no pet equipped.");
    return embed;
  }
  const petAsset = p.id ? await getPet(p.id).catch(() => undefined) : undefined;
  embed.addFields(
    { name: "Pet", value: petAsset?.name ?? p.name ?? fv(p.id), inline: true },
    { name: "Level", value: fv(p.level), inline: true },
    { name: "XP", value: fv(p.xp), inline: true }
  );
  if (petAsset?.imageUrl) embed.setImage(petAsset.imageUrl);
  if (p.skinId) {
    const skin = await getPetSkin(p.skinId).catch(() => undefined);
    if (skin?.name) embed.addFields({ name: "Skin", value: skin.name, inline: true });
  }
  if (p.selectedSkillId) {
    embed.addFields({ name: "Skill ID", value: p.selectedSkillId, inline: true });
  }
  return embed;
}

// ── /freefire weapons ───────────────────────────────────────────────────────
export async function buildWeaponsEmbed(b: PlayerBasic, skins: WeaponSkin[]): Promise<EmbedBuilder> {
  const embed = await header(b, `🔫 Weapon Skins — ${b.nickname ?? b.uid}`);
  if (skins.length === 0) {
    embed.setDescription("No weapon skins are equipped.");
    return embed;
  }
  const assets = await getAssets(skins.map((s) => s.id), "weapon_skin");
  embed.addFields({
    name: `Equipped (${skins.length})`,
    value: assets.map((a, i) => `**${i + 1}.** ${a.name}`).join("\n").slice(0, 1024) || "—",
    inline: false,
  });
  const first = assets.find((a) => a.imageUrl);
  if (first?.imageUrl) embed.setImage(first.imageUrl);
  return embed;
}

// ── /freefire honor ─────────────────────────────────────────────────────────
export async function buildHonorEmbed(b: PlayerBasic, h: HonorInfo): Promise<EmbedBuilder> {
  const embed = await header(b, `🎖️ Honor — ${b.nickname ?? b.uid}`);
  embed.addFields(
    { name: "Honor Score", value: fv(h.honorScore), inline: true },
    { name: "Badges", value: fv(h.badges), inline: true }
  );
  if (h.badgeId) {
    const badge = await getBadge(h.badgeId).catch(() => undefined);
    if (badge?.name) embed.addFields({ name: "Badge", value: badge.name, inline: true });
    if (badge?.imageUrl) embed.setImage(badge.imageUrl);
  }
  return embed;
}

// ── /freefire likes ─────────────────────────────────────────────────────────
export async function buildLikesEmbed(b: PlayerBasic): Promise<EmbedBuilder> {
  const embed = await header(b, `❤️ Likes — ${b.nickname ?? b.uid}`);
  embed.addFields({ name: "Total Likes", value: fv(b.liked), inline: true });
  return embed;
}

// ── /freefire leaderboard ───────────────────────────────────────────────────
import type { LeaderboardEntry } from "./extract.js";
export async function buildLeaderboardEmbed(b: PlayerBasic, entries: LeaderboardEntry[]): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(ACCENT_GOLD)
    .setTitle("🏆 Leaderboard")
    .setDescription(`Region: **${(b.region as string).toUpperCase()}**`)
    .setFooter({ text: "Data: Free Fire Community API · cached" })
    .setTimestamp();
  if (entries.length === 0) {
    embed.setDescription("ℹ️ Leaderboard data is not included in the cached player response. It would require a separate API endpoint.");
    return embed;
  }
  embed.addFields({
    name: "Top Players",
    value: entries.slice(0, 10).map((e) => `**#${e.rank ?? "?"}** ${e.name ?? e.uid ?? "—"} — ${e.points ?? "—"} pts`).join("\n").slice(0, 1024),
    inline: false,
  });
  return embed;
}

// ── /freefire compare ───────────────────────────────────────────────────────
export async function buildCompareEmbed(b1: PlayerBasic, b2: PlayerBasic): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`⚖️ Compare — ${b1.nickname ?? b1.uid} vs ${b2.nickname ?? b2.uid}`)
    .addFields(
      { name: "Player", value: b1.nickname ?? b1.uid, inline: true },
      { name: "vs", value: "—", inline: true },
      { name: "Player", value: b2.nickname ?? b2.uid, inline: true },
      { name: "Level", value: fv(b1.level), inline: true },
      { name: "—", value: "—", inline: true },
      { name: "Level", value: fv(b2.level), inline: true },
      { name: "Likes", value: fv(b1.liked), inline: true },
      { name: "—", value: "—", inline: true },
      { name: "Likes", value: fv(b2.liked), inline: true },
      { name: "BR Points", value: fv(b1.rankingPoints), inline: true },
      { name: "—", value: "—", inline: true },
      { name: "BR Points", value: fv(b2.rankingPoints), inline: true }
    )
    .setFooter({ text: "Data: Free Fire Community API · cached" })
    .setTimestamp();
  return embed;
}

// ── /freefire achievements ──────────────────────────────────────────────────
export async function buildAchievementsEmbed(b: PlayerBasic, h: HonorInfo): Promise<EmbedBuilder> {
  const embed = await header(b, `🏅 Achievements — ${b.nickname ?? b.uid}`);
  // The /info response exposes badgeCnt (total badges) but not the achievement
  // list itself. Show what's available.
  embed.setDescription(`This player has **${fv(h.badges, "0")}** badges (Honor Score: ${fv(h.honorScore)}). Detailed achievement lists require a separate API endpoint not currently cached.`);
  return embed;
}

// ── /freefire region (cache status) ─────────────────────────────────────────
export async function buildRegionEmbed(b: PlayerBasic, cachedAt: Date, expiresAt: Date): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setColor(ACCENT_GREEN)
    .setTitle(`🌍 Region — ${b.nickname ?? b.uid}`)
    .addFields(
      { name: "UID", value: fv(b.uid), inline: true },
      { name: "Region", value: fv((b.region as string).toUpperCase()), inline: true },
      { name: "Version", value: fv(b.releaseVersion), inline: true },
      { name: "Cached At", value: cachedAt.toUTCString(), inline: true },
      { name: "Expires At", value: expiresAt.toUTCString(), inline: true }
    )
    .setFooter({ text: "Data: Free Fire Community API · cached" })
    .setTimestamp();
  return embed;
}

// ── Error embed ─────────────────────────────────────────────────────────────
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(ACCENT_RED).setTitle("❌ Free Fire").setDescription(message).setTimestamp();
}
