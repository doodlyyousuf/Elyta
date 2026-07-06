
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getInviteCount, getInviteLeaderboard } from "../../systems/invites/inviteRewards.js";
import { showInviteLeaderboard } from "../../systems/invites/leaderboard.js";

export const data = new SlashCommandBuilder()
  .setName("invites")
  .setDescription("View invite stats and leaderboard")
  .addSubcommand((s) => s.setName("me").setDescription("Your invite count"))
  .addSubcommand((s) => s.setName("leaderboard").setDescription("Top inviters"))
  .addSubcommand((s) =>
    s.setName("user").setDescription("Another user's count").addUserOption((o) => o.setName("member").setDescription("User to check").setRequired(true))
  );

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();
  if (sub === "me") {
    const count = await getInviteCount(interaction.guildId, interaction.user.id);
    return interaction.editReply(`📨 You have **${count}** invite${count === 1 ? "" : "s"}.`);
  }
  if (sub === "user") {
    const user = interaction.options.getUser("member", true);
    const count = await getInviteCount(interaction.guildId, user.id);
    return interaction.editReply(`📨 ${user.tag} has **${count}** invite${count === 1 ? "" : "s"}.`);
  }
  await showInviteLeaderboard(interaction);
}
