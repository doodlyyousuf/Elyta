
import { SlashCommandBuilder } from "discord.js";
import { createOrder } from "../../systems/smp/orderHelper.js";

export const data = new SlashCommandBuilder()
  .setName("order")
  .setDescription("Place an SMP build order")
  .addStringOption((o) => o.setName("description").setDescription("What you need built").setRequired(true));

export async function execute(interaction: any) {
  const description = interaction.options.getString("description", true);
  try {
    const order = await createOrder(interaction.guildId, interaction.user.id, description);
    await interaction.editReply(`✅ Order #${order.id} submitted! Use \`/order-status\` to check progress.`);
  } catch {
    await interaction.editReply("❌ Failed to create order.");
  }
}
