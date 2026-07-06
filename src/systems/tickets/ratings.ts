
import { EmbedBuilder, MessageFlags } from "discord.js";
import { supabase } from "../../database/supabase.js";
import { sendTicketLog } from "./logs.js";

export async function submitTicketRating(interaction: any, ticketId: number, rating: number) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return interaction.update({ content: "❌ Ticket not found.", components: [] });
  }

  if (ticket.user_id !== interaction.user.id) {
    return interaction.update({ content: "❌ You can only rate your own tickets.", components: [] });
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from("ticket_ratings")
    .select("*")
    .eq("ticket_id", ticketId)
    .single();

  if (existing) {
    return interaction.update({ content: "❌ You have already rated this ticket.", components: [] });
  }

  await supabase.from("ticket_ratings").insert({
    ticket_id: ticketId,
    user_id: interaction.user.id,
    rating: rating,
  });

  const stars = "⭐".repeat(rating);
  const embed = new EmbedBuilder()
    .setDescription(`✅ Thank you for rating your experience! ${stars}`)
    .setColor(0xffd700);

  await interaction.update({ content: "", embeds: [embed], components: [] });

  // Log rating to ticket logs channel
  const guild = interaction.client.guilds.cache.get(ticket.guild_id);
  if (guild) {
    await sendTicketLog(
      interaction.client,
      guild,
      `⭐ **Ticket Rated**\nTicket: #${ticketId}\nUser: ${interaction.user.tag}\nRating: ${rating}/5 stars`
    );
  }
}

export async function getTicketStats(interaction: any) {
  // NOTE: interactionCreate already deferred the reply for chat-input commands.
  // Do NOT call deferReply here — that throws InteractionAlreadyReplied.
  const guild = interaction.guild;

  const { data: ratings } = await supabase
    .from("ticket_ratings")
    .select("rating")
    .eq("guild_id", guild.id);

  if (!ratings || ratings.length === 0) {
    return interaction.editReply({ content: "📊 No ratings available yet." });
  }

  const avgRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
  const totalRatings = ratings.length;

  const distribution = [1, 2, 3, 4, 5].map(stars => {
    const count = ratings.filter((r: any) => r.rating === stars).length;
    return `${"⭐".repeat(stars)}: ${count}`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("📊 Ticket Rating Statistics")
    .addFields(
      { name: "Average Rating", value: `${avgRating.toFixed(2)}/5 ⭐`, inline: true },
      { name: "Total Ratings", value: totalRatings.toString(), inline: true },
      { name: "Distribution", value: distribution, inline: false }
    )
    .setColor(0xffd700)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
