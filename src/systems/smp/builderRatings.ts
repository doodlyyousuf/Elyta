import { EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export async function rateBuilder(guildId: string, builderId: string, rating: number, orderId: number) {
  await supabase.from("builder_ratings").insert({
    guild_id: guildId,
    builder_id: builderId,
    rating,
    order_id: orderId,
  });
}

export async function getBuilderStats(guildId: string, builderId: string) {
  const { data: ratings } = await supabase
    .from("builder_ratings")
    .select("*")
    .eq("guild_id", guildId)
    .eq("builder_id", builderId);

  if (!ratings || ratings.length === 0) {
    return { averageRating: 0, totalRatings: 0, totalOrders: 0 };
  }

  const averageRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
  const totalRatings = ratings.length;

  const { count } = await supabase
    .from("smp_orders")
    .select("*", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("builder_id", builderId)
    .eq("status", "completed");

  return {
    averageRating: averageRating.toFixed(2),
    totalRatings,
    totalOrders: count || 0,
  };
}

export async function showBuilderLeaderboard(interaction: any) {
  const guild = interaction.guild;
  const { data: ratings } = await supabase
    .from("builder_ratings")
    .select("builder_id, rating")
    .eq("guild_id", guild.id);

  if (!ratings || ratings.length === 0) {
    return interaction.editReply("📊 No builder ratings yet.");
  }

  const builderStats = new Map<string, { total: number; count: number }>();
  ratings.forEach((r: any) => {
    const current = builderStats.get(r.builder_id) || { total: 0, count: 0 };
    current.total += r.rating;
    current.count += 1;
    builderStats.set(r.builder_id, current);
  });

  const sorted = Array.from(builderStats.entries())
    .map(([builderId, stats]) => ({
      builderId,
      average: stats.total / stats.count,
      count: stats.count,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);

  const lines = await Promise.all(sorted.map(async (entry, index) => {
    const user = await guild.client.users.fetch(entry.builderId).catch(() => null);
    const name = user?.tag || entry.builderId;
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
    return `${medal} **${name}** - ${entry.average.toFixed(2)}⭐ (${entry.count} ratings)`;
  }));

  const embed = new EmbedBuilder()
    .setTitle("🏆 Builder Leaderboard")
    .setDescription(lines.join("\n"))
    .setColor(0xffd700)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
