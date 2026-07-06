
import { sendModLog } from "../systems/logging/logHelper.js";

export default {
  name: "voiceStateUpdate",
  async execute(oldState: any, newState: any) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldCh = oldState.channel?.name || "none";
    const newCh = newState.channel?.name || "none";

    if (oldCh === newCh) return;

    let action = "moved";
    if (!oldState.channel && newState.channel) action = "joined";
    else if (oldState.channel && !newState.channel) action = "left";

    await sendModLog(
      member.guild,
      "🔊 Voice Update",
      `**${member.user.tag}** ${action} voice: ${oldCh} → ${newCh}`,
      0x9b59b6
    );
  },
};
