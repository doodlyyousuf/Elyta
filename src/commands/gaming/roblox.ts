
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("Get Roblox user info")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Roblox username")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const username = interaction.options.getString("username");

    try {
      // Get user ID from username
      const userResponse = await fetch(
        `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`
      );
      const userData = await userResponse.json();

      if (!userData.data || userData.data.length === 0) {
        return interaction.editReply("❌ Roblox user not found.");
      }

      const user = userData.data[0];

      // Get user details
      const detailsResponse = await fetch(`https://users.roblox.com/v1/users/${user.id}`);
      const detailsData = await detailsResponse.json();

      // Get friend count
      const friendsResponse = await fetch(`https://friends.roblox.com/v1/users/${user.id}/friends/count`);
      const friendsData = await friendsResponse.json();

      // Get follower count
      const followersResponse = await fetch(`https://friends.roblox.com/v1/users/${user.id}/followers/count`);
      const followersData = await followersResponse.json();

      // Get following count
      const followingResponse = await fetch(`https://friends.roblox.com/v1/users/${user.id}/followings/count`);
      const followingData = await followingResponse.json();

      const embed = {
        color: 0xE2231A,
        title: `🎮 Roblox Profile - ${user.name}`,
        thumbnail: {
          url: `https://www.roblox.com/headshot-thumbnail/image?userId=${user.id}&width=420&height=420&format=png`,
        },
        url: `https://www.roblox.com/users/${user.id}/profile`,
        fields: [
          { name: "Display Name", value: user.displayName || user.name, inline: true },
          { name: "User ID", value: user.id.toString(), inline: true },
          { name: "Description", value: detailsData.description || "No description", inline: false },
          { name: "Friends", value: friendsData.count?.toString() || "0", inline: true },
          { name: "Followers", value: followersData.count?.toString() || "0", inline: true },
          { name: "Following", value: followingData.count?.toString() || "0", inline: true },
          { name: "Created", value: detailsData.created ? `<t:${new Date(detailsData.created).getTime() / 1000}:R>` : "N/A", inline: true },
        ],
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(
        "❌ Failed to fetch Roblox data. Please check the username or try again later."
      );
    }
  },
};
