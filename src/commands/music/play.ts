/**
 * /play — Play a song or add it to the queue.
 *
 * Fixes C-03: previously declared `execute(interaction, distube: DisTube)` but
 * interactionCreate calls `cmd.execute(interaction, client)` — so distube was
 * undefined and every /play threw. DisTube is now read from
 * `client.distube` (or `interaction.client.distube` as a fallback) which the
 * orchestrator attaches in src/index.ts.
 *
 * `DisTube` is imported as a TYPE ONLY — the instance comes from the client.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  TextChannel,
  VoiceBasedChannel,
} from "discord.js";
import type { DisTube } from "distube";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or add it to the queue")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("Song name or URL")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, client?: Client) {
    // Read DisTube from the client (orchestrator attaches `client.distube`).
    // Fall back to interaction.client to remain backwards-compatible with both
    // call styles (with or without an explicit client argument).
    const distube: DisTube | undefined = (client ?? interaction.client).distube;
    if (!distube) {
      return interaction.editReply({
        content: "❌ Music is not available right now.",
      });
    }

    const song = interaction.options.getString("song", true);
    const member = interaction.member as GuildMember | null;
    const voiceChannel: VoiceBasedChannel | null =
      member?.voice?.channel ?? null;

    if (!voiceChannel) {
      return interaction.editReply({
        content: "❌ You need to be in a voice channel to play music!",
      });
    }

    // interactionCreate already deferred the reply — use editReply directly.
    try {
      await distube.play(voiceChannel, song, {
        member: member ?? undefined,
        textChannel: (interaction.channel as TextChannel | null) ?? undefined,
      });

      await interaction.editReply(`🎵 Playing: **${song}**`);
    } catch (error) {
      await interaction.editReply(
        "❌ Failed to play the song. Please try again."
      );
    }
  },
};
