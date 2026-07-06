
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getInviteLeaderboard } from "../../systems/invites/inviteRewards.js";

export const data = new SlashCommandBuilder()
  .setName("invite-leaderboard")
  .setDescription("View the top 10 inviters in this server");

export async function execute(interaction: any) {
  const leaderboard = await getInviteLeaderboard(interaction.guildId, 10);

  if (!leaderboard.length) {
    return interaction.editReply("📨 No invite data yet. Start inviting people!");
  }

  const lines = leaderboard.map((entry, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`${i + 1}.\``;
    return `${medal} <@${entry.userId}> — **${entry.invites}** invite${entry.invites === 1 ? "" : "s"}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 Invite Leaderboard")
    .setDescription(lines.join("\n"))
    .setColor(0x7289da)
    .setFooter({ text: `Top ${leaderboard.length} inviters` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
