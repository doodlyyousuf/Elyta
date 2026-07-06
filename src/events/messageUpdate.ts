
import { sendModLog } from "../systems/logging/logHelper.js";

export default {
  name: "messageUpdate",
  async execute(oldMessage: any, newMessage: any) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    await sendModLog(
      newMessage.guild,
      "✏️ Message Edited",
      `**Author:** ${newMessage.author.tag}\n**Channel:** <#${newMessage.channel.id}>\n**Before:** ${oldMessage.content?.slice(0, 300) || "(empty)"}\n**After:** ${newMessage.content?.slice(0, 300) || "(empty)"}`,
      0xf39c12
    );
  },
};
