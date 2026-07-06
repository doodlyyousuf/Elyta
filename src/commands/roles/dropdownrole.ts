
import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dropdownrole")
    .setDescription("Create a dropdown menu for role selection")
    .addStringOption(option =>
      option
        .setName("title")
        .setDescription("Title for the dropdown menu")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("role1")
        .setDescription("First role option")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("label1")
        .setDescription("Label for role 1")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("role2")
        .setDescription("Second role option")
    )
    .addStringOption(option =>
      option
        .setName("label2")
        .setDescription("Label for role 2")
    )
    .addRoleOption(option =>
      option
        .setName("role3")
        .setDescription("Third role option")
    )
    .addStringOption(option =>
      option
        .setName("label3")
        .setDescription("Label for role 3")
    )
    .addRoleOption(option =>
      option
        .setName("role4")
        .setDescription("Fourth role option")
    )
    .addStringOption(option =>
      option
        .setName("label4")
        .setDescription("Label for role 4")
    )
    .addRoleOption(option =>
      option
        .setName("role5")
        .setDescription("Fifth role option")
    )
    .addStringOption(option =>
      option
        .setName("label5")
        .setDescription("Label for role 5")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: any) {
    const title = interaction.options.getString("title");
    const role1 = interaction.options.getRole("role1");
    const label1 = interaction.options.getString("label1");
    const role2 = interaction.options.getRole("role2");
    const label2 = interaction.options.getString("label2");
    const role3 = interaction.options.getRole("role3");
    const label3 = interaction.options.getString("label3");
    const role4 = interaction.options.getRole("role4");
    const label4 = interaction.options.getString("label4");
    const role5 = interaction.options.getRole("role5");
    const label5 = interaction.options.getString("label5");

    const options: StringSelectMenuOptionBuilder[] = [
      new StringSelectMenuOptionBuilder()
        .setLabel(label1)
        .setValue(role1.id),
    ];

    if (role2 && label2) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(label2)
          .setValue(role2.id)
      );
    }
    if (role3 && label3) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(label3)
          .setValue(role3.id)
      );
    }
    if (role4 && label4) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(label4)
          .setValue(role4.id)
      );
    }
    if (role5 && label5) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(label5)
          .setValue(role5.id)
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`dropdown_${interaction.id}`)
          .setPlaceholder(title)
          .addOptions(options)
      );

    await interaction.editReply({
      content: `📋 **${title}**`,
      components: [row],
    });

    // Create collector for dropdown interactions
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 0, // No timeout
    });

    collector.on("collect", async (i: any) => {
      if (i.customId !== `dropdown_${interaction.id}`) return;

      const roleId = i.values[0];
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) return;

      const member = i.member;

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await i.reply({
          content: `❌ Removed role: **${role.name}**`,
          ephemeral: true,
        });
      } else {
        await member.roles.add(roleId);
        await i.reply({
          content: `✅ Added role: **${role.name}**`,
          ephemeral: true,
        });
      }
    });
  },
};
