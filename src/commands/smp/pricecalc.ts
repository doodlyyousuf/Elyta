
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("pricecalc")
  .setDescription("Calculate price for an SMP build order")
  .addStringOption((o) => o.setName("type").setDescription("Build type").setRequired(true).addChoices(
    { name: "Small Build", value: "small" },
    { name: "Medium Build", value: "medium" },
    { name: "Large Build", value: "large" },
    { name: "Custom", value: "custom" }
  ))
  .addIntegerOption((o) => o.setName("blocks").setDescription("Estimated block count").setMinValue(0))
  .addIntegerOption((o) => o.setName("hours").setDescription("Estimated hours").setMinValue(1))
  .addIntegerOption((o) => o.setName("custom_price").setDescription("Custom price (if type is custom)").setMinValue(0));

export async function execute(interaction: any) {
  const type = interaction.options.getString("type", true);
  const blocks = interaction.options.getInteger("blocks") || 0;
  const hours = interaction.options.getInteger("hours") || 1;
  const customPrice = interaction.options.getInteger("custom_price") || 0;

  let basePrice = 0;
  let pricePerBlock = 0;
  let pricePerHour = 500; // Default hourly rate

  switch (type) {
    case "small":
      basePrice = 1000;
      pricePerBlock = 0.01;
      break;
    case "medium":
      basePrice = 5000;
      pricePerBlock = 0.005;
      break;
    case "large":
      basePrice = 15000;
      pricePerBlock = 0.002;
      break;
    case "custom":
      basePrice = customPrice;
      pricePerBlock = 0;
      break;
  }

  const blockCost = blocks * pricePerBlock;
  const hourCost = hours * pricePerHour;
  const totalPrice = basePrice + blockCost + hourCost;

  const embed = new EmbedBuilder()
    .setTitle("💰 Price Calculator")
    .addFields(
      { name: "Build Type", value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
      { name: "Base Price", value: `$${basePrice}`, inline: true },
      { name: "Block Count", value: blocks.toLocaleString(), inline: true },
      { name: "Block Cost", value: `$${blockCost.toFixed(2)}`, inline: true },
      { name: "Estimated Hours", value: hours.toString(), inline: true },
      { name: "Hourly Cost", value: `$${hourCost}`, inline: true },
      { name: "Total Price", value: `$${totalPrice.toFixed(2)}`, inline: false }
    )
    .setColor(0x00ff00)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
