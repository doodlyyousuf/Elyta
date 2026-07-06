
import { EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export async function recordEarnings(guildId: string, builderId: string, orderId: number, amount: number) {
  await supabase.from("builder_earnings").insert({
    guild_id: guildId,
    builder_id: builderId,
    order_id: orderId,
    amount,
  });
}

export async function getBuilderEarnings(guildId: string, builderId: string) {
  const { data: earnings } = await supabase
    .from("builder_earnings")
    .select("amount")
    .eq("guild_id", guildId)
    .eq("builder_id", builderId);

  if (!earnings || earnings.length === 0) {
    return { totalEarnings: 0, orderCount: 0 };
  }

  const totalEarnings = earnings.reduce((sum: number, e: any) => sum + e.amount, 0);
  return { totalEarnings, orderCount: earnings.length };
}

export async function showEarningsLeaderboard(interaction: any) {
  const guild = interaction.guild;
  const { data: earnings } = await supabase
    .from("builder_earnings")
    .select("builder_id, amount")
    .eq("guild_id", guild.id);

  if (!earnings || earnings.length === 0) {
    return interaction.editReply("💰 No earnings data yet.");
  }

  const builderEarnings = new Map<string, number>();
  earnings.forEach((e: any) => {
    const current = builderEarnings.get(e.builder_id) || 0;
    builderEarnings.set(e.builder_id, current + e.amount);
  });

  const sorted = Array.from(builderEarnings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const lines = await Promise.all(sorted.map(async (entry, index) => {
    const user = await guild.client.users.fetch(entry[0]).catch(() => null);
    const name = user?.tag || entry[0];
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
    return `${medal} **${name}** - $${entry[1].toLocaleString()}`;
  }));

  const embed = new EmbedBuilder()
    .setTitle("💰 Earnings Leaderboard")
    .setDescription(lines.join("\n"))
    .setColor(0x00ff00)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
