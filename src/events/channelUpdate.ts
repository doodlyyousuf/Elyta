
import { sendChannelLog } from "../systems/logging/logHelper.js";

export default {
  name: "channelUpdate",
  async execute(oldChannel: any, newChannel: any) {
    if (!newChannel.guild) return;

    const changes = [];
    if (oldChannel.name !== newChannel.name) {
      changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(`**Topic:** ${oldChannel.topic || "None"} → ${newChannel.topic || "None"}`);
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`**NSFW:** ${oldChannel.nsfw} → ${newChannel.nsfw}`);
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`**Slowmode:** ${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      const oldParent = oldChannel.parent?.name || "None";
      const newParent = newChannel.parent?.name || "None";
      changes.push(`**Category:** ${oldParent} → ${newParent}`);
    }

    if (changes.length === 0) return;

    await sendChannelLog(
      newChannel.guild,
      "📁 Channel Updated",
      `**Channel:** ${newChannel.name}\n${changes.join("\n")}`,
      0xf39c12
    );
  },
};
