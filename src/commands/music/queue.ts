/**
 * /queue — Show the current music queue.
 *
 * Fixes C-03: previously declared `execute(interaction, distube: DisTube)` but
 * interactionCreate calls `cmd.execute(interaction, client)` — so distube was
 * undefined. DisTube is now read from `client.distube` (or
 * `interaction.client.distube` as a fallback) which the orchestrator attaches
 * in src/index.ts.
 *
 * Fixes L-02: previously built a raw `{ color, title, ... }` object instead of
 * using EmbedBuilder. Now uses EmbedBuilder while preserving the same fields
 * (Now Playing, Total Songs, Duration).
 *
 * `DisTube` and `Queue`/`Song` are imported as TYPES ONLY — the instance comes
 * from the client.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
} from "discord.js";
import type { DisTube, Queue, Song } from "distube";

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),

  async execute(interaction: ChatInputCommandInteraction, client?: Client) {
    const distube: DisTube | undefined = (client ?? interaction.client).distube;
    if (!distube) {
      return interaction.editReply({
        content: "❌ Music is not available right now.",
      });
    }

    const queue: Queue | undefined = distube.getQueue(interaction.guildId ?? "");

    if (!queue || queue.songs.length === 0) {
      return interaction.editReply({
        content: "❌ The queue is empty!",
      });
    }

    const queueList = queue.songs
      .map((song: Song, index: number) => `${index + 1}. ${song.name} - ${song.formattedDuration}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎵 Music Queue")
      .setDescription(queueList.slice(0, 2000))
      .addFields(
        { name: "Now Playing", value: String(queue.songs[0]?.name ?? "—"), inline: true },
        { name: "Total Songs", value: queue.songs.length.toString(), inline: true },
        { name: "Duration", value: String(queue.formattedDuration ?? "—"), inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
