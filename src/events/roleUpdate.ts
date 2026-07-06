
import { sendRoleLog } from "../systems/logging/logHelper.js";

export default {
  name: "roleUpdate",
  async execute(oldRole: any, newRole: any) {
    if (!newRole.guild) return;

    const changes = [];
    if (oldRole.name !== newRole.name) {
      changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);
    }
    if (oldRole.color !== newRole.color) {
      changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push(`**Permissions:** Updated`);
    }
    if (oldRole.hoist !== newRole.hoist) {
      changes.push(`**Hoisted:** ${oldRole.hoist} → ${newRole.hoist}`);
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push(`**Mentionable:** ${oldRole.mentionable} → ${newRole.mentionable}`);
    }

    if (changes.length === 0) return;

    await sendRoleLog(
      newRole.guild,
      "🔖 Role Updated",
      `**Role:** ${newRole.name}\n${changes.join("\n")}`,
      0xf39c12
    );
  },
};
