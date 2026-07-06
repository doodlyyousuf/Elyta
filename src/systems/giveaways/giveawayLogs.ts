
import { EmbedBuilder, Guild, TextChannel } from "discord.js";
import { getGuild } from "../../database/db.js";

/**
 * Resolve the configured giveaway-log channel for a guild.
 *
 * Reads `giveaway_log_channel_id` from `guild_settings`, falling back to the
 * generic `log_channel_id`. Returns `undefined` when nothing is configured or
 * the configured channel can't be found — in which case the public `log*`
 * helpers NO-OP (M-06 fix: we never auto-create channels any more).
 */
async function resolveGiveawayLogChannel(guild: Guild): Promise<TextChannel | undefined> {
  let settings: Record<string, unknown> | null = null;
  try {
    settings = await getGuild(guild.id);
  } catch (err) {
    console.warn(`[giveawayLogs] Failed to read guild_settings for ${guild.id}:`, err);
    return undefined;
  }

  const specificId = settings?.["giveaway_log_channel_id"];
  const fallbackId = settings?.["log_channel_id"];
  const candidateId =
    (typeof specificId === "string" && specificId.trim()) ||
    (typeof fallbackId === "string" && fallbackId.trim()) ||
    undefined;
  if (!candidateId) return undefined;

  const cached = guild.channels.cache.get(candidateId) as TextChannel | undefined;
  if (cached && cached.isTextBased()) return cached;

  try {
    const fetched = await guild.channels.fetch(candidateId);
    if (fetched && fetched.isTextBased()) return fetched as TextChannel;
  } catch {
    /* treat as unconfigured */
  }
  return undefined;
}

export async function logGiveawayAction(
  guild: Guild,
  action: string,
  details: string
): Promise<void> {
  const channel = await resolveGiveawayLogChannel(guild);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${action}`)
    .setDescription(details)
    .setColor(0x5865f2)
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[giveawayLogs] Failed to send giveaway log:", err);
  }
}

export async function logGiveawayCreated(
  guild: Guild,
  prize: string,
  winners: number,
  endTime: Date,
  host: string
): Promise<void> {
  await logGiveawayAction(
    guild,
    "Giveaway Created",
    `**Host:** ${host}\n**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`
  );
}

export async function logGiveawayEnded(
  guild: Guild,
  prize: string,
  winners: string[]
): Promise<void> {
  await logGiveawayAction(
    guild,
    "Giveaway Ended",
    `**Prize:** ${prize}\n**Winners:** ${winners.join(", ") || "None"}`
  );
}

export async function logGiveawayRerolled(
  guild: Guild,
  prize: string,
  newWinners: string[]
): Promise<void> {
  await logGiveawayAction(
    guild,
    "Giveaway Rerolled",
    `**Prize:** ${prize}\n**New Winners:** ${newWinners.join(", ")}`
  );
}
