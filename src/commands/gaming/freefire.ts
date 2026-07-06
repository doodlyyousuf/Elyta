/**
 * /freefire — Free Fire player lookup.
 *
 * Uses the Free Fire Community API (https://github.com/ashqking/Free-Fire-API).
 * Get a free API key at https://developers.freefirecommunity.com and set
 * FREEFIRE_API_KEY in your .env file (free tier: 100 requests/hour).
 *
 * Subcommands:
 *   /freefire info      uid:<uid> region:[sg|ind|br]   — profile (level, rank, clan)
 *   /freefire stats     uid:<uid> region:[sg|ind|br]   — career stats per mode
 *   /freefire bancheck  uid:<uid>                      — ban status
 *
 * Notes:
 *  • interactionCreate pre-defers the reply, so this command uses editReply.
 *  • All option ordering is required-before-optional (Discord requirement).
 *  • Errors from the API are surfaced as actionable ephemeral-style messages.
 */
import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import {
  getPlayerInfo,
  getPlayerStats,
  getBanCheck,
  FreeFireError,
  REGIONS,
  type Region,
} from "../../lib/freefire.js";
import { log } from "../../lib/logger.js";

export default {
  data: new SlashCommandBuilder()
    .setName("freefire")
    .setDescription("Free Fire player stats (via the Free Fire Community API)")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Player profile — nickname, level, rank, clan")
        .addStringOption((o) =>
          o.setName("uid").setDescription("Free Fire player UID").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o
            .setName("region")
            .setDescription("Player region")
            .addChoices(
              { name: "India (ind)", value: "ind" },
              { name: "Singapore (sg)", value: "sg" },
              { name: "Brazil (br)", value: "br" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("Career gameplay stats per mode")
        .addStringOption((o) =>
          o.setName("uid").setDescription("Free Fire player UID").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o
            .setName("region")
            .setDescription("Player region")
            .addChoices(
              { name: "India (ind)", value: "ind" },
              { name: "Singapore (sg)", value: "sg" },
              { name: "Brazil (br)", value: "br" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("bancheck")
        .setDescription("Check whether an account is banned")
        .addStringOption((o) =>
          o.setName("uid").setDescription("Free Fire player UID").setRequired(true).setMaxLength(32)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const uid = interaction.options.getString("uid", true).trim();
    const regionRaw = interaction.options.getString("region") || "ind";
    const region = (REGIONS.includes(regionRaw as Region) ? regionRaw : "ind") as Region;

    try {
      if (sub === "info") {
        await replyInfo(interaction, await getPlayerInfo(uid, region));
      } else if (sub === "stats") {
        await replyStats(interaction, await getPlayerStats(uid, region));
      } else if (sub === "bancheck") {
        await replyBanCheck(interaction, await getBanCheck(uid, "en"));
      } else {
        await interaction.editReply("❌ Unknown subcommand.");
      }
    } catch (err: any) {
      if (err instanceof FreeFireError) {
        log.warn("freefire command failed", { kind: err.kind, status: err.status, uid, region });
        await interaction.editReply(`❌ ${err.message}`);
      } else {
        log.error("freefire command failed", { error: err?.message, stack: err?.stack, uid, region });
        await interaction.editReply(`❌ Unexpected error: ${err?.message ?? err}`);
      }
    }
  },
};

async function replyInfo(interaction: ChatInputCommandInteraction, p: Awaited<ReturnType<typeof getPlayerInfo>>) {
  const embed = new EmbedBuilder()
    .setColor(0xff5733)
    .setTitle(`🔥 Free Fire — ${p.nickname ?? `UID ${p.uid}`}`)
    .addFields(
      { name: "UID", value: p.uid, inline: true },
      { name: "Region", value: p.region.toUpperCase(), inline: true },
      { name: "Level", value: p.level != null ? String(p.level) : "—", inline: true },
      { name: "Ranked Points", value: p.rankedPoints != null ? String(p.rankedPoints) : "—", inline: true },
      { name: "EXP", value: p.exp != null ? p.exp.toLocaleString() : "—", inline: true },
      { name: "Likes", value: p.likes != null ? p.likes.toLocaleString() : "—", inline: true }
    )
    .setFooter({ text: "Data: Free Fire Community API" })
    .setTimestamp();

  if (p.guildName || p.guildId) {
    embed.addFields({
      name: "Guild",
      value: [
        p.guildName ? `**${p.guildName}**` : "",
        p.guildId ? `ID: \`${p.guildId}\`` : "",
        p.guildLevel != null ? `Level ${p.guildLevel}` : "",
        p.guildMembers != null ? `${p.guildMembers} members` : "",
      ]
        .filter(Boolean)
        .join(" · ") || "—",
      inline: false,
    });
  }
  if (p.title) embed.addFields({ name: "Title", value: p.title, inline: true });
  if (p.bioName || p.bioDescription) {
    embed.addFields({
      name: "Bio",
      value: [p.bioName ? `**${p.bioName}**` : "", p.bioDescription ?? ""].filter(Boolean).join("\n") || "—",
      inline: false,
    });
  }
  if (p.createAt || p.lastLoginAt) {
    embed.addFields({
      name: "Dates",
      value: [
        p.createAt ? `Created: ${fmtDate(p.createAt)}` : "",
        p.lastLoginAt ? `Last login: ${fmtDate(p.lastLoginAt)}` : "",
      ]
        .filter(Boolean)
        .join("\n") || "—",
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function replyStats(interaction: ChatInputCommandInteraction, s: Awaited<ReturnType<typeof getPlayerStats>>) {
  const embed = new EmbedBuilder()
    .setColor(0xff5733)
    .setTitle(`📊 Free Fire Stats — UID ${s.uid}`)
    .setDescription(`Region: **${s.region.toUpperCase()}**`)
    .setFooter({ text: "Data: Free Fire Community API" })
    .setTimestamp();

  if (!s.modes || s.modes.length === 0) {
    embed.setDescription(`Region: **${s.region.toUpperCase()}**\n\nNo per-mode stats were returned for this player.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Aggregate totals across modes
  const totalGames = s.modes.reduce((a, m) => a + (m.games ?? 0), 0);
  const totalWins = s.modes.reduce((a, m) => a + (m.wins ?? 0), 0);
  const totalKills = s.modes.reduce((a, m) => a + (m.kills ?? 0), 0);
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) + "%" : "—";
  const kd = totalGames > 0 ? (totalKills / Math.max(totalGames - totalWins, 1)).toFixed(2) : "—";

  embed.addFields(
    { name: "Total Games", value: totalGames.toLocaleString(), inline: true },
    { name: "Total Wins", value: totalWins.toLocaleString(), inline: true },
    { name: "Win Rate", value: winRate, inline: true },
    { name: "Total Kills", value: totalKills.toLocaleString(), inline: true },
    { name: "K/D", value: kd, inline: true }
  );

  for (const m of s.modes.slice(0, 5)) {
    const name = m.name.charAt(0).toUpperCase() + m.name.slice(1);
    const mWinRate = m.games ? (((m.wins ?? 0) / m.games) * 100).toFixed(1) + "%" : "—";
    embed.addFields({
      name: name,
      value: [
        `Games: ${m.games ?? "—"}`,
        `Wins: ${m.wins ?? "—"} (${mWinRate})`,
        `Kills: ${m.kills ?? "—"}`,
        `Headshots: ${m.headshots ?? "—"}`,
      ].join("\n"),
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function replyBanCheck(interaction: ChatInputCommandInteraction, b: Awaited<ReturnType<typeof getBanCheck>>) {
  const embed = new EmbedBuilder()
    .setColor(b.banned ? 0xe74c3c : 0x2ecc71)
    .setTitle(b.banned ? "🚫 Account Banned" : "✅ Account Not Banned")
    .addFields({ name: "UID", value: b.uid, inline: true })
    .setFooter({ text: "Data: Free Fire Community API" })
    .setTimestamp();

  if (b.banPeriodText) embed.addFields({ name: "Ban Period", value: String(b.banPeriodText), inline: true });
  if (b.banStartText) embed.addFields({ name: "Ban Start", value: fmtDate(b.banStartText), inline: true });
  if (b.banEndText) embed.addFields({ name: "Ban End", value: fmtDate(b.banEndText), inline: true });

  await interaction.editReply({ embeds: [embed] });
}

function fmtDate(s: string): string {
  // The API returns ISO strings or epoch-ms numbers-as-strings; be lenient.
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    // treat as epoch seconds if it looks like one, else ms
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toUTCString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toUTCString();
}
