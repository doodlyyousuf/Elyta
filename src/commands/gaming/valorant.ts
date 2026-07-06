
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("valorant")
    .setDescription("Get Valorant player stats")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Riot username (format: Name#Tag)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("region")
        .setDescription("Region (na, eu, ap, kr)")
        .setRequired(true)
        .addChoices(
          { name: "North America", value: "na" },
          { name: "Europe", value: "eu" },
          { name: "Asia Pacific", value: "ap" },
          { name: "Korea", value: "kr" }
        )
    ),

  async execute(interaction: any) {
    const username = interaction.options.getString("username");
    const region = interaction.options.getString("region");

    try {
      // Parse username (Name#Tag format)
      const [name, tag] = username.split("#");
      if (!name || !tag) {
        return interaction.editReply("❌ Invalid username format. Use Name#Tag");
      }

      // Use Valorant API (you'll need to use a third-party API like henrikdev)
      const response = await fetch(
        `https://api.henrikdev.xyz/valorant/v1/account/${name}/${tag}?region=${region}`
      );

      if (!response.ok) {
        throw new Error("Player not found");
      }

      const data = await response.json();

      const embed = {
        color: 0xFF4655,
        title: `🎯 Valorant Stats - ${data.data.name}#${data.data.tag}`,
        thumbnail: {
          url: data.data.avatar || null,
        },
        fields: [
          { name: "Account Level", value: data.data.account_level?.toString() || "N/A", inline: true },
          { name: "Region", value: region.toUpperCase(), inline: true },
          { name: "Current Rank", value: data.data.current_data?.currenttier?.patched_tier || "Unranked", inline: true },
          { name: "Rank Rating", value: data.data.current_data?.ranking_in_tier?.toString() || "N/A", inline: true },
          { name: "Peak Rank", value: data.data.current_data?.peak_rank?.patched_tier || "N/A", inline: true },
        ],
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(
        "❌ Failed to fetch Valorant stats. Please check the username and region, or try again later."
      );
    }
  },
};
