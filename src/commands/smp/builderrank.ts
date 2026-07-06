
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { showBuilderLeaderboard } from "../../systems/smp/builderRatings.js";
import { showEarningsLeaderboard } from "../../systems/smp/earningsTracker.js";

export const data = new SlashCommandBuilder()
  .setName("builderrank")
  .setDescription("View builder leaderboards")
  .addSubcommand((s) => s.setName("ratings").setDescription("Top rated builders"))
  .addSubcommand((s) => s.setName("earnings").setDescription("Top earning builders"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();

  if (sub === "ratings") {
    await showBuilderLeaderboard(interaction);
  } else {
    await showEarningsLeaderboard(interaction);
  }
}
