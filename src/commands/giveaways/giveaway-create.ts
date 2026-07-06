
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { buildActiveGiveawayEmbed, formatPrize } from "../../systems/giveaways/giveawayEmbeds.js";
import { logGiveawayCreated } from "../../systems/giveaways/giveawayLogs.js";
import { log } from "../../lib/logger.js";

export const data = new SlashCommandBuilder()
  .setName("giveaway-create")
  .setDescription("Create a new giveaway")
  .addStringOption((o) => o.setName("prize").setDescription("Prize (text)").setRequired(true).setMaxLength(256))
  .addIntegerOption((o) => o.setName("duration").setDescription("Minutes").setRequired(true).setMinValue(1).setMaxValue(10080))
  .addIntegerOption((o) => o.setName("winners").setDescription("Winner count").setRequired(true).setMinValue(1).setMaxValue(10))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: any) {
  const prize = formatPrize(interaction.options.getString("prize", true));
  const duration = interaction.options.getInteger("duration", true);
  const winners = interaction.options.getInteger("winners", true);
  const endTime = new Date(Date.now() + duration * 60000);

  const embed = buildActiveGiveawayEmbed({ prize, winners, endTime, hostTag: interaction.user.tag });
  const message = await interaction.channel.send({ embeds: [embed] });
  await message.react("🎉");

  const { error } = await supabase.from("giveaways").insert({
    guild_id: interaction.guildId,
    channel_id: interaction.channelId,
    message_id: message.id,
    prize,
    winners,
    end_time: endTime.toISOString(),
    ended: false,
  });

  if (error) {
    log.error("giveaway-create DB insert failed", {
      error: error.message,
      code: error.code,
      hint: error.hint,
    });
    await interaction.editReply(
      `❌ Failed to save giveaway: \`${error.message}\`` +
        (error.hint ? `\n💡 ${error.hint}` : "") +
        `\n\nIf the error mentions a missing column (e.g. \`end_time\`), re-run the SQL migration in \`supabase/migrations/0001_corrected_schema.sql\`.`
    );
  } else {
    await logGiveawayCreated(interaction.guild, prize, winners, endTime, interaction.user.tag);
    await interaction.editReply(`✅ Giveaway created! Prize: **${prize}** — ends in ${duration} minutes.`);
  }
}
