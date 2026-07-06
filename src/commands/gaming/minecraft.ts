
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("minecraft")
    .setDescription("Get Minecraft server or player stats")
    .addSubcommand(subcommand =>
      subcommand
        .setName("server")
        .setDescription("Get Minecraft server stats")
        .addStringOption(option =>
          option
            .setName("address")
            .setDescription("Server address (e.g., mc.hypixel.net)")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("player")
        .setDescription("Get Minecraft player info")
        .addStringOption(option =>
          option
            .setName("username")
            .setDescription("Minecraft username")
            .setRequired(true)
        )
    ),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "server") {
        const address = interaction.options.getString("address");
        const response = await fetch(`https://api.mcsrvstat.us/2/${address}`);
        const data = await response.json();

        if (!data.online) {
          return interaction.editReply("❌ Server is offline or doesn't exist.");
        }

        const embed = {
          color: 0x5865F2,
          title: `⛏️ Minecraft Server - ${data.hostname || address}`,
          fields: [
            { name: "Status", value: "🟢 Online", inline: true },
            { name: "Players", value: `${data.players.online}/${data.players.max}`, inline: true },
            { name: "Version", value: data.version || "N/A", inline: true },
            { name: "MOTD", value: data.motd?.clean?.join("\n") || "N/A", inline: false },
          ],
        };

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "player") {
        const username = interaction.options.getString("username");
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        
        if (!response.ok) {
          return interaction.editReply("❌ Player not found.");
        }

        const data = await response.json();

        const embed = {
          color: 0x5865F2,
          title: `🎮 Minecraft Player - ${data.name}`,
          fields: [
            { name: "UUID", value: data.id, inline: true },
            { name: "Username", value: data.name, inline: true },
          ],
          thumbnail: {
            url: `https://crafatar.com/avatars/${data.id}`,
          },
        };

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      await interaction.editReply("❌ Failed to fetch Minecraft data. Please try again later.");
    }
  },
};
