
import { sendRoleLog } from "../systems/logging/logHelper.js";

export default {
  name: "guildMemberUpdate",
  async execute(oldMember: any, newMember: any) {
    if (!newMember.guild) return;

    const changes = [];

    // Check for role changes
    const oldRoles = oldMember.roles.cache.map((r: any) => r.id);
    const newRoles = newMember.roles.cache.map((r: any) => r.id);

    const addedRoles = newRoles.filter((id: string) => !oldRoles.includes(id));
    const removedRoles = oldRoles.filter((id: string) => !newRoles.includes(id));

    if (addedRoles.length > 0) {
      const roleNames = addedRoles.map((id: string) => newMember.guild.roles.cache.get(id)?.name || "Unknown").join(", ");
      changes.push(`**Roles Added:** ${roleNames}`);
    }
    if (removedRoles.length > 0) {
      const roleNames = removedRoles.map((id: string) => newMember.guild.roles.cache.get(id)?.name || "Unknown").join(", ");
      changes.push(`**Roles Removed:** ${roleNames}`);
    }

    // Check for nickname changes
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**Nickname:** ${oldMember.nickname || "None"} → ${newMember.nickname || "None"}`);
    }

    // Check for avatar changes
    if (oldMember.avatar !== newMember.avatar) {
      changes.push(`**Avatar:** Updated`);
    }

    if (changes.length === 0) return;

    await sendRoleLog(
      newMember.guild,
      "👤 Member Updated",
      `**User:** ${newMember.user.tag}\n${changes.join("\n")}`,
      0x3498db
    );
  },
};
