import { EmbedBuilder } from "discord.js";
import { supabase } from "../../database/supabase.js";

export async function getInviteLeaderboard(guild: any, limit: number = 10) {
  const { data } = await supabase
    .from("invite_tracking")
    .select("inviter_id")
    .eq("guild_id", guild.id);

  if (!data || data.length === 0) return [];

  const counts = new Map<string, number>();
  data.forEach((row: any) => {
    counts.set(row.inviter_id, (counts.get(row.inviter_id) || 0) + 1);
  });

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sorted.map(([userId, count], index) => {
    const user = guild.client.users.cache.get(userId);
    return {
      rank: index + 1,
      user: user?.tag || "Unknown",
      userId,
      count,
    };
  });
}

export async function showInviteLeaderboard(interaction: any) {
  const guild = interaction.guild;
  const leaderboard = await getInviteLeaderboard(guild);

  if (leaderboard.length === 0) {
    return interaction.editReply("📊 No invite data available yet.");
  }

  const lines = leaderboard.map((entry) => {
    const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
    return `${medal} **${entry.user}** - ${entry.count} invites`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏆 Invite Leaderboard")
    .setDescription(lines)
    .setColor(0xffd700)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
