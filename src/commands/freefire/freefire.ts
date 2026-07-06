/**
 * /freefire — the single parent command for every Free Fire feature.
 *
 * Design contract (redesign brief):
 *   • Every subcommand starts with /freefire (no generic /rank, /stats, …).
 *   • At most ONE API request per UID per hour. All subcommands read from the
 *     cached complete API response (freefire_player_cache.api_response JSONB).
 *   • The cache layer (getOrFetch) is the ONLY place that may call the API.
 *   • Raw numeric asset IDs are never shown — the Asset Service resolves them
 *     to names + images (with a raw-ID fallback for unknown assets).
 *   • Every execution is logged to freefire_command_logs (cache_hit, api_called,
 *     execution_time_ms).
 *
 * Subcommands:
 *   /freefire profile       uid region   — full profile (level, rank, guild, pet, …)
 *   /freefire stats         uid region   — career stats per mode
 *   /freefire rank          uid region   — BR + CS ranks
 *   /freefire guild         uid region   — guild info
 *   /freefire pet           uid region   — equipped pet
 *   /freefire weapons       uid region   — equipped weapon skins
 *   /freefire honor         uid region   — honor score + badges + achievements
 *   /freefire likes         uid region   — likes count
 *   /freefire leaderboard   uid region   — leaderboard (from cache if present)
 *   /freefire compare       uid1 uid2 region — side-by-side comparison
 *   /freefire lookup        uid region   — cache age / region / refresh info
 *   /freefire region        uid region   — alias of lookup
 *   /freefire achievements  uid region   — achievement list
 *
 * Option ordering: required-before-optional (Discord requirement).
 * interactionCreate pre-defers → this command uses editReply.
 */
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getOrFetch, type Region, REGIONS, FreeFireError } from "../../lib/freefire/index.js";
import {
  basic, guild, pet, ranks, stats, honor, weaponSkins, leaderboard,
} from "../../lib/freefire/extract.js";
import {
  buildProfileEmbed, buildStatsEmbed, buildRankEmbed, buildGuildEmbed,
  buildPetEmbed, buildWeaponsEmbed, buildHonorEmbed, buildLikesEmbed,
  buildLeaderboardEmbed, buildCompareEmbed, buildAchievementsEmbed,
  buildRegionEmbed, buildErrorEmbed,
} from "../../lib/freefire/embeds.js";
import { logCommand } from "../../lib/freefire/logging.js";
import { supabase } from "../../database/supabase.js";
import { log } from "../../lib/logger.js";

function regionChoices() {
  return [
    { name: "India (ind)", value: "ind" },
    { name: "Singapore (sg)", value: "sg" },
    { name: "Brazil (br)", value: "br" },
  ];
}

const uidOption = (o: any) =>
  o.setName("uid").setDescription("Free Fire player UID").setRequired(true).setMaxLength(32);

const regionOption = (o: any) =>
  o.setName("region").setDescription("Player region (defaults to ind)").addChoices(...regionChoices());

export default {
  data: new SlashCommandBuilder()
    .setName("freefire")
    .setDescription("Free Fire player stats (via the Free Fire Community API)")
    .addSubcommand((s) =>
      s.setName("profile").setDescription("Player profile — level, rank, guild, pet, bio")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("stats").setDescription("Career gameplay stats per mode")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("rank").setDescription("BR + Clash Squad ranks")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("guild").setDescription("Guild info for the player")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("pet").setDescription("Equipped pet info")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("weapons").setDescription("Equipped weapon skins")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("honor").setDescription("Honor score, badges, achievements")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("likes").setDescription("Player likes count")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("leaderboard").setDescription("Leaderboard (from cached data)")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("achievements").setDescription("Achievement list")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("compare").setDescription("Compare two players side by side")
        .addStringOption((o) => o.setName("uid1").setDescription("First player UID").setRequired(true).setMaxLength(32))
        .addStringOption((o) => o.setName("uid2").setDescription("Second player UID").setRequired(true).setMaxLength(32))
        .addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("lookup").setDescription("Cache status for a UID (region, cache age)")
        .addStringOption(uidOption).addStringOption(regionOption))
    .addSubcommand((s) =>
      s.setName("region").setDescription("Alias of lookup — cache status for a UID")
        .addStringOption(uidOption).addStringOption(regionOption)),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const started = Date.now();

    // Helper to resolve (uid, region) for single-player subcommands.
    const resolveSingle = (): { uid: string; region: Region } => {
      const uid = interaction.options.getString("uid", true).trim();
      const regionRaw = interaction.options.getString("region") || "ind";
      const region: Region = (REGIONS as string[]).includes(regionRaw) ? (regionRaw as Region) : "ind";
      return { uid, region };
    };

    let uid: string | undefined;
    let region: Region | undefined;
    let cacheHit = false;
    let apiCalled = false;
    let success = true;
    let errorMessage: string | undefined;

    try {
      switch (sub) {
        case "compare": {
          const uid1 = interaction.options.getString("uid1", true).trim();
          const uid2 = interaction.options.getString("uid2", true).trim();
          const regionRaw = interaction.options.getString("region") || "ind";
          region = ((REGIONS as string[]).includes(regionRaw) ? regionRaw : "ind") as Region;

          // Fetch both (each may hit cache or API). Run in parallel.
          const [r1, r2] = await Promise.all([
            getOrFetch(uid1, region).catch((e) => { throw e; }),
            getOrFetch(uid2, region).catch((e) => { throw e; }),
          ]);
          cacheHit = r1.cacheHit && r2.cacheHit;
          apiCalled = r1.apiCalled || r2.apiCalled;
          uid = `${uid1},${uid2}`;

          const b1 = basic(r1.data, uid1, region);
          const b2 = basic(r2.data, uid2, region);
          await interaction.editReply({ embeds: [await buildCompareEmbed(b1, b2)] });
          break;
        }

        case "lookup":
        case "region": {
          const s = resolveSingle();
          uid = s.uid; region = s.region;
          // Look up the cache row directly (don't force an API call).
          const { data } = await supabase
            .from("freefire_player_cache")
            .select("api_response, cached_at, expires_at")
            .eq("uid", uid)
            .eq("region", region)
            .maybeSingle();
          if (!data) {
            success = false;
            errorMessage = "No cached data for this UID. Run another /freefire subcommand first to fetch.";
            await interaction.editReply({
              embeds: [buildErrorEmbed(`No cached data for UID \`${uid}\` in region \`${region}\`. Run \`/freefire profile uid:${uid}\` first to fetch.`)],
            });
            break;
          }
          cacheHit = true;
          const b = basic(data.api_response, uid, region);
          await interaction.editReply({
            embeds: [await buildRegionEmbed(b, new Date(data.cached_at), new Date(data.expires_at))],
          });
          break;
        }

        default: {
          // All single-player data subcommands.
          const s = resolveSingle();
          uid = s.uid; region = s.region;
          const result = await getOrFetch(uid, region);
          cacheHit = result.cacheHit;
          apiCalled = result.apiCalled;
          const raw = result.data;
          const b = basic(raw, uid, region);
          const g = guild(raw);
          const r = ranks(raw);
          const p = pet(raw);
          const h = honor(raw);
          const modes = stats(raw);
          const skins = weaponSkins(raw);

          let embed;
          switch (sub) {
            case "profile":      embed = await buildProfileEmbed(b, g, r, h, p); break;
            case "stats":        embed = await buildStatsEmbed(b, modes); break;
            case "rank":         embed = await buildRankEmbed(b, r); break;
            case "guild":        embed = await buildGuildEmbed(b, g); break;
            case "pet":          embed = await buildPetEmbed(b, p); break;
            case "weapons":      embed = await buildWeaponsEmbed(b, skins); break;
            case "honor":        embed = await buildHonorEmbed(b, h); break;
            case "likes":        embed = await buildLikesEmbed(b); break;
            case "leaderboard":  embed = await buildLeaderboardEmbed(b, leaderboard(raw)); break;
            case "achievements": embed = await buildAchievementsEmbed(b, h); break;
            default:
              await interaction.editReply(`❌ Unknown subcommand: ${sub}`);
              success = false;
              errorMessage = `unknown subcommand ${sub}`;
              break;
          }
          if (embed) await interaction.editReply({ embeds: [embed] });
        }
      }
    } catch (err: any) {
      success = false;
      errorMessage = err?.message ?? String(err);
      if (err instanceof FreeFireError) {
        log.warn("freefire command failed", { kind: err.kind, status: err.status, sub, uid, region });
        await interaction.editReply({ embeds: [buildErrorEmbed(err.message)] }).catch(() => {});
      } else {
        log.error("freefire command failed", { error: err?.message, stack: err?.stack, sub, uid, region });
        await interaction.editReply({ embeds: [buildErrorEmbed(`Unexpected error: ${err?.message ?? err}`)] }).catch(() => {});
      }
    } finally {
      // Always log the execution (best-effort, non-fatal).
      await logCommand({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        uid: uid ?? null,
        commandName: `freefire ${sub}`,
        cacheHit,
        apiCalled,
        executionTimeMs: Date.now() - started,
        success,
        errorMessage: success ? null : errorMessage,
      }).catch(() => {});
    }
  },
};
