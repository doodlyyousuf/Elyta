
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("steam")
    .setDescription("Get Steam user profile info")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Steam username or profile URL")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const username = interaction.options.getString("username");

    try {
      // Resolve vanity URL to Steam ID
      const vanityResponse = await fetch(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API_KEY}&vanityurl=${username}`
      );
      const vanityData = await vanityResponse.json();

      if (vanityData.response.success !== 1) {
        return interaction.editReply("❌ Steam user not found.");
      }

      const steamId = vanityData.response.steamid;

      // Get player summary
      const summaryResponse = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
      );
      const summaryData = await summaryResponse.json();

      const player = summaryData.response.players[0];

      if (!player) {
        return interaction.editReply("❌ Failed to fetch player data.");
      }

      const embed = {
        color: 0x1B2838,
        title: `🎮 Steam Profile - ${player.personaname}`,
        thumbnail: {
          url: player.avatarfull,
        },
        url: player.profileurl,
        fields: [
          { name: "Steam ID", value: steamId, inline: true },
          { name: "Status", value: player.personastate === 1 ? "🟢 Online" : "⚫ Offline", inline: true },
          { name: "Country", value: player.loccountrycode || "N/A", inline: true },
          { name: "Account Created", value: player.timecreated ? `<t:${player.timecreated}:R>` : "N/A", inline: true },
        ],
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(
        "❌ Failed to fetch Steam data. Please check the username or try again later."
      );
    }
  },
};
