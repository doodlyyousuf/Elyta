
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getOrder, updateOrderStatus } from "../../systems/smp/orderHelper.js";

export const data = new SlashCommandBuilder()
  .setName("builder")
  .setDescription("Manage SMP orders (staff)")
  .addSubcommand((s) =>
    s.setName("complete").setDescription("Mark order complete")
      .addIntegerOption((o) => o.setName("id").setDescription("Order ID").setRequired(true))
      .addIntegerOption((o) => o.setName("price").setDescription("Final price").setRequired(true).setMinValue(0))
  )
  .addSubcommand((s) =>
    s.setName("assign").setDescription("Assign order to yourself")
      .addIntegerOption((o) => o.setName("id").setDescription("Order ID").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: any) {
  const sub = interaction.options.getSubcommand();
  const id = interaction.options.getInteger("id", true);
  const order = await getOrder(id);
  if (!order || order.guild_id !== interaction.guildId) return interaction.editReply("❌ Order not found.");

  if (sub === "complete") {
    const price = interaction.options.getInteger("price", true);
    await updateOrderStatus(id, "completed", interaction.user.id, price);
    await interaction.editReply(`✅ Order #${id} marked as **completed**. Earnings: $${price}`);
  } else {
    await updateOrderStatus(id, "in_progress", interaction.user.id);
    await interaction.editReply(`✅ Order #${id} assigned to you.`);
  }
}
