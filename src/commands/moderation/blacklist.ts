
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { addToBlacklist, removeFromBlacklist, getBlacklist } from "../../systems/security/blacklist.js";

export const data = new SlashCommandBuilder()
  .setName("blacklist")
  .setDescription("Manage the server blacklist")
  .addSubcommand((s) =>
    s.setName("add").setDescription("Add user to blacklist")
      .addUserOption((o) => o.setName("user").setDescription("User to blacklist").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason for blacklist"))
  )
  .addSubcommand((s) =>
    s.setName("remove").setDescription("Remove user from blacklist")
      .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(true))
  )
  .addSubcommand((s) => s.setName("list").setDescription("View blacklist"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";

    await addToBlacklist(interaction.guildId, user.id, reason, interaction.user.id);

    // Kick if they're in the server
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      await member.kick(`Blacklisted: ${reason}`).catch(() => {});
    }

    await interaction.editReply(`✅ ${user.tag} has been blacklisted.`);
  } else if (sub === "remove") {
    const user = interaction.options.getUser("user", true);
    await removeFromBlacklist(interaction.guildId, user.id);
    await interaction.editReply(`✅ ${user.tag} has been removed from the blacklist.`);
  } else if (sub === "list") {
    const blacklist = await getBlacklist(interaction.guildId);

    if (blacklist.length === 0) {
      return interaction.editReply("📋 The blacklist is empty.");
    }

    const lines = blacklist.map((entry: any) => {
      const addedBy = interaction.client.users.cache.get(entry.added_by)?.tag || "Unknown";
      return `**${entry.user_id}** - ${entry.reason} (Added by ${addedBy})`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📋 Server Blacklist")
      .setDescription(lines.slice(0, 4000))
      .setColor(0xff0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
