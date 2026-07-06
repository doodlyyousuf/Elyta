import { EmbedBuilder } from "discord.js";

const ACTIVE_COLOR = 0xffd700;
const ENDED_COLOR = 0x2f3136;

export function formatPrize(prize: unknown): string {
  return String(prize ?? "Unknown prize");
}

export function buildActiveGiveawayEmbed(options: {
  prize: unknown;
  winners: number;
  endTime: Date;
  hostTag?: string;
}) {
  const endUnix = Math.floor(options.endTime.getTime() / 1000);
  const prize = formatPrize(options.prize);

  const embed = new EmbedBuilder()
    .setTitle(prize)
    .setColor(0xff9f43) // Premium Coral/Amber
    .setDescription("Press the **🎉** reaction below to participate and win!")
    .addFields(
      { name: "👥 Winner Count", value: `**${options.winners}** winner(s)`, inline: true },
      { name: "⏰ Ends In", value: `<t:${endUnix}:R>\n(<t:${endUnix}:F>)`, inline: true }
    )
    .setFooter({ text: "Good luck! • Make sure to click the reaction" })
    .setTimestamp(options.endTime);

  embed.setAuthor({
    name: `🎁 ACTIVE GIVEAWAY${options.hostTag ? ` • Hosted by ${options.hostTag}` : ""}`
  });
  return embed;
}

export function buildEndedGiveawayEmbed(options: {
  prize: unknown;
  winners: number;
  winnerMentions: string;
  endedEarly?: boolean;
}) {
  const prize = formatPrize(options.prize);
  
  if (options.endedEarly) {
    // Keep original ended early design as requested
    return new EmbedBuilder()
      .setTitle("🎉 Giveaway Ended Early")
      .setColor(ENDED_COLOR)
      .setDescription("Thanks to everyone who entered!")
      .addFields(
        { name: "🏆 Prize", value: prize, inline: false },
        { name: "👑 Winner(s)", value: options.winnerMentions || "No valid entries", inline: false }
      )
      .setTimestamp();
  }

  // Premium design for naturally ended giveaways
  return new EmbedBuilder()
    .setTitle("✨  GIVEAWAY CONCLUDED  ✨")
    .setColor(0x2f3136) // Sleek dark aesthetic
    .setDescription(`The giveaway for **${prize}** has officially ended.`)
    .addFields(
      { name: "🏆 Prize Item", value: `**${prize}**`, inline: false },
      { name: "👑 Winner(s)", value: options.winnerMentions ? `Congratulations to: ${options.winnerMentions}` : "No valid entries", inline: false }
    )
    .setFooter({ text: "Thank you to everyone who participated!" })
    .setTimestamp();
}

export function buildRerollGiveawayEmbed(options: { prize: unknown; winnerMentions: string }) {
  const prize = formatPrize(options.prize);
  return new EmbedBuilder()
    .setTitle("🔄 Giveaway Rerolled")
    .setColor(0x5865f2)
    .addFields(
      { name: "🏆 Prize", value: prize, inline: false },
      { name: "👑 New Winner(s)", value: options.winnerMentions || "No valid entries", inline: false }
    )
    .setTimestamp();
}

export function buildNoParticipantsEmbed(prize: unknown) {
  return new EmbedBuilder()
    .setTitle("⚠️ Giveaway Ended — No Winners")
    .setColor(0xff6b6b)
    .setDescription(`Nobody entered the giveaway for **${formatPrize(prize)}**.`)
    .setTimestamp();
}
