
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("massrole")
    .setDescription("Add or remove a role from multiple members")
    .addSubcommand(subcommand =>
      subcommand
        .setName("add")
        .setDescription("Add a role to all members")
        .addRoleOption(option =>
          option.setName("role").setDescription("The role to add").setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("Remove a role from all members")
        .addRoleOption(option =>
          option.setName("role").setDescription("The role to remove").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: any) {
    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole("role");

    try {
      const members = await interaction.guild.members.fetch();
      let count = 0;

      for (const [, member] of members) {
        if (member.user.bot) continue;
        
        if (subcommand === "add") {
          if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            count++;
          }
        } else {
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            count++;
          }
        }
      }

      await interaction.editReply(
        `✅ ${subcommand === "add" ? "Added" : "Removed"} role **${role.name}** from ${count} members.`
      );
    } catch (error) {
      await interaction.editReply("❌ Failed to execute mass role operation.");
    }
  },
};
