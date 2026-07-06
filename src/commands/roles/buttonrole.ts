
import { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { saveButtonRole } from "../../systems/roles/roleHelper.js";

export const data = new SlashCommandBuilder()
  .setName("buttonrole")
  .setDescription("Create a button role panel")
  .addRoleOption((o) => o.setName("role").setDescription("Role").setRequired(true))
  .addStringOption((o) => o.setName("label").setDescription("Button label").setRequired(true))
  .addStringOption((o) => o.setName("emoji").setDescription("Button emoji"))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const role = interaction.options.getRole("role", true);
  const label = interaction.options.getString("label", true);
  const emoji = interaction.options.getString("emoji") || undefined;

  await saveButtonRole(interaction.guildId, role.id, label, emoji);

  const btn = new ButtonBuilder()
    .setCustomId(`role_${role.id}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary);
  if (emoji) btn.setEmoji(emoji);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);
  await interaction.channel.send({ content: `Click to toggle **${role.name}**:`, components: [row] });
  await interaction.editReply("✅ Button role panel sent!");
}
