
import { sendModLog } from "../systems/logging/logHelper.js";

export default {
  name: "messageDelete",
  async execute(message: any) {
    if (!message.guild || message.author?.bot) return;
    const content = message.content?.slice(0, 500) || "(no content)";
    await sendModLog(
      message.guild,
      "🗑️ Message Deleted",
      `**Author:** ${message.author?.tag || "unknown"}\n**Channel:** <#${message.channel.id}>\n**Content:** ${content}`,
      0xe74c3c
    );
  },
};
