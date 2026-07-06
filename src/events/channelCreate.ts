
import { sendChannelLog } from "../systems/logging/logHelper.js";

export default {
  name: "channelCreate",
  async execute(channel: any) {
    if (!channel.guild) return;
    await sendChannelLog(
      channel.guild,
      "📁 Channel Created",
      `**${channel.name}** (${channel.id})\nType: ${channel.type}\nCategory: ${channel.parent?.name || "None"}`,
      0x2ecc71
    );
  },
};
