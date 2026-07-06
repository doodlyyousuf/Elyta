import { adminRoles, owners } from "../config.js";

export function isAdmin(member: any): boolean {
  if (!member) return false;
  if (owners.includes(member.id)) return true;
  if (member.permissions.has("Administrator")) return true;
  return adminRoles.some((id) => member.roles.cache.has(id));
}
