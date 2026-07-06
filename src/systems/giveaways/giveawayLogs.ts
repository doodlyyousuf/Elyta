import { EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export async function logGiveawayAction(guild: any, action: string, details: string) {
  let channel = guild.channels.cache.find((c: any) => c.name === "giveaway-logs" && c.isTextBased());
  if (!channel) {
    channel = await guild.channels.create({ name: "giveaway-logs", topic: "Giveaway activity logs" }).catch(() => null);
  }
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${action}`)
    .setDescription(details)
    .setColor(0x5865f2)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

export async function logGiveawayCreated(guild: any, prize: string, winners: number, endTime: Date, host: string) {
  await logGiveawayAction(
    guild,
    "Giveaway Created",
    `**Host:** ${host}\n**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`
  );
}

export async function logGiveawayEnded(guild: any, prize: string, winners: string[]) {
  await logGiveawayAction(
    guild,
    "Giveaway Ended",
    `**Prize:** ${prize}\n**Winners:** ${winners.join(", ") || "None"}`
  );
}

export async function logGiveawayRerolled(guild: any, prize: string, newWinners: string[]) {
  await logGiveawayAction(
    guild,
    "Giveaway Rerolled",
    `**Prize:** ${prize}\n**New Winners:** ${newWinners.join(", ")}`
  );
}
