
import { sendChannelLog } from "../systems/logging/logHelper.js";

export default {
  name: "channelDelete",
  async execute(channel: any) {
    if (!channel.guild) return;
    await sendChannelLog(
      channel.guild,
      "📁 Channel Deleted",
      `**${channel.name}** (${channel.id}) was deleted.\nType: ${channel.type}`,
      0xe74c3c
    );
  },
};
