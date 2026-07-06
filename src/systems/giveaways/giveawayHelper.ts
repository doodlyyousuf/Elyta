
import { supabase } from "../../database/supabase.js";
import {
  buildActiveGiveawayEmbed,
  buildEndedGiveawayEmbed,
  buildNoParticipantsEmbed,
  formatPrize,
} from "./giveawayEmbeds.js";
import { logGiveawayEnded } from "./giveawayLogs.js";

export async function pickGiveawayWinners(reaction: any, winnerCount: number) {
  const users = await reaction.users.fetch();
  const participants = users.filter((u: any) => !u.bot);
  const winners = [];
  const shuffled = [...participants.values()];

  for (let i = 0; i < Math.min(winnerCount, shuffled.length); i++) {
    const randomIndex = Math.floor(Math.random() * shuffled.length);
    winners.push(shuffled[randomIndex]);
    shuffled.splice(randomIndex, 1);
  }

  return { winners, participants };
}

export async function endGiveaway(giveawayId: number, client: any) {
  try {
    const { data: giveaway } = await supabase
      .from("giveaways")
      .select("*")
      .eq("id", giveawayId)
      .single();

    if (!giveaway || giveaway.ended) return;

    const channel = await client.channels.fetch(giveaway.channel_id);
    const message = await channel.messages.fetch(giveaway.message_id);
    const reaction = message.reactions.cache.get("🎉");

    if (!reaction) {
      await channel.send({ embeds: [buildNoParticipantsEmbed(giveaway.prize)] });
      await supabase.from("giveaways").update({ ended: true }).eq("id", giveawayId);
      return;
    }

    const { winners, participants } = await pickGiveawayWinners(reaction, giveaway.winners);

    if (participants.size === 0) {
      await channel.send({ embeds: [buildNoParticipantsEmbed(giveaway.prize)] });
      await supabase.from("giveaways").update({ ended: true }).eq("id", giveawayId);
      return;
    }

    const winnerMentions = winners.map((w: any) => w.toString()).join(", ");
    const prize = formatPrize(giveaway.prize);

    await channel.send({
      content: winners.length ? `🎊 Congratulations ${winnerMentions}!` : undefined,
      embeds: [buildEndedGiveawayEmbed({ prize, winners: giveaway.winners, winnerMentions })],
    });

    await logGiveawayEnded(channel.guild, prize, winnerMentions.split(", "));

    await message.edit({
      embeds: [
        buildActiveGiveawayEmbed({
          prize,
          winners: giveaway.winners,
          endTime: new Date(giveaway.end_time),
        })
          .setTitle("🎉  GIVEAWAY ENDED  🎉")
          .setColor(0x2f3136),
      ],
    });

    await supabase.from("giveaways").update({ ended: true }).eq("id", giveawayId);
  } catch (error) {
    console.error("Error ending giveaway:", error);
  }
}

export async function checkActiveGiveaways(client: any) {
  const { data: activeGiveaways } = await supabase
    .from("giveaways")
    .select("*")
    .eq("ended", false)
    .lt("end_time", new Date().toISOString());

  if (activeGiveaways) {
    for (const giveaway of activeGiveaways) {
      await endGiveaway(giveaway.id, client);
    }
  }
}
