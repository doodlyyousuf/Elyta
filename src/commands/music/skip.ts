/**
 * /skip — Skip the current song.
 *
 * Fixes C-03: previously declared `execute(interaction, distube: DisTube)` but
 * interactionCreate calls `cmd.execute(interaction, client)` — so distube was
 * undefined. DisTube is now read from `client.distube` (or
 * `interaction.client.distube` as a fallback) which the orchestrator attaches
 * in src/index.ts.
 *
 * `DisTube` is imported as a TYPE ONLY — the instance comes from the client.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  VoiceBasedChannel,
} from "discord.js";
import type { DisTube, Queue } from "distube";

export default {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),

  async execute(interaction: ChatInputCommandInteraction, client?: Client) {
    const distube: DisTube | undefined = (client ?? interaction.client).distube;
    if (!distube) {
      return interaction.editReply({
        content: "❌ Music is not available right now.",
      });
    }

    const member = interaction.member as GuildMember | null;
    const voiceChannel: VoiceBasedChannel | null =
      member?.voice?.channel ?? null;

    if (!voiceChannel) {
      return interaction.editReply({
        content: "❌ You need to be in a voice channel to skip!",
      });
    }

    try {
      // Resolve the guild queue and skip via the queue (DisTube v5 API).
      const queue: Queue | undefined = distube.getQueue(
        interaction.guildId ?? ""
      );
      if (!queue) {
        await interaction.editReply({
          content: "❌ No song to skip or failed to skip.",
        });
        return;
      }
      await queue.skip();
      await interaction.editReply("⏭️ Skipped the current song!");
    } catch (error) {
      await interaction.editReply({
        content: "❌ No song to skip or failed to skip.",
      });
    }
  },
};
