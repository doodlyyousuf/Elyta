
import { owners, adminRoles, modRoles, supportRoles } from "../../config.js";

export function isOwner(userId: string): boolean {
  return owners.includes(userId);
}

export function isAdmin(member: any): boolean {
  if (isOwner(member.id)) return true;
  return member.roles.cache.some((role: any) => adminRoles.includes(role.id));
}

export function isMod(member: any): boolean {
  if (isOwner(member.id)) return true;
  if (isAdmin(member)) return true;
  return member.roles.cache.some((role: any) => modRoles.includes(role.id));
}

export function isStaff(member: any): boolean {
  if (isMod(member)) return true;
  return member.roles.cache.some((role: any) => supportRoles.includes(role.id));
}

export function hasPermission(member: any, requiredPermission: "owner" | "admin" | "mod" | "staff"): boolean {
  switch (requiredPermission) {
    case "owner":
      return isOwner(member.id);
    case "admin":
      return isAdmin(member);
    case "mod":
      return isMod(member);
    case "staff":
      return isStaff(member);
    default:
      return false;
  }
}
