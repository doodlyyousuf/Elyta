
import { sendRoleLog } from "../systems/logging/logHelper.js";

export default {
  name: "roleCreate",
  async execute(role: any) {
    if (!role.guild) return;
    await sendRoleLog(
      role.guild,
      "➕ Role Created",
      `**${role.name}** (${role.id})\nColor: ${role.hexColor}\nMentionable: ${role.mentionable}`,
      0x2ecc71
    );
  },
};
