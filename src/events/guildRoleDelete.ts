
import { sendRoleLog } from "../systems/logging/logHelper.js";

export default {
  name: "roleDelete",
  async execute(role: any) {
    if (!role.guild) return;
    await sendRoleLog(
      role.guild,
      "➖ Role Deleted",
      `**${role.name}** (${role.id}) was deleted.`,
      0xe74c3c
    );
  },
};
