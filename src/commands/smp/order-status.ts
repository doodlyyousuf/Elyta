
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrder, getUserOrders } from "../../systems/smp/orderHelper.js";

export const data = new SlashCommandBuilder()
  .setName("order-status")
  .setDescription("Check SMP order status")
  .addIntegerOption((o) => o.setName("id").setDescription("Order ID (omit for your orders)"));

export async function execute(interaction: any) {
  const id = interaction.options.getInteger("id");
  if (id) {
    const order = await getOrder(id);
    if (!order || order.guild_id !== interaction.guildId) return interaction.editReply("❌ Order not found.");
    return interaction.editReply(`📦 Order #${order.id} — **${order.status}**\n${order.description}`);
  }
  const orders = await getUserOrders(interaction.guildId, interaction.user.id);
  if (!orders.length) return interaction.editReply("📦 You have no orders.");
  const lines = orders.map((o: any) => `#${o.id} — **${o.status}** — ${o.description?.slice(0, 50)}`);
  const embed = new EmbedBuilder().setTitle("Your Orders").setDescription(lines.join("\n")).setColor(0x5865f2);
  await interaction.editReply({ embeds: [embed] });
}
