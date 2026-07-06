/**
 * Backwards-compatible permission helpers (H-11 architecture cleanup).
 *
 * The canonical permission helpers live at
 * `src/systems/security/permissions.ts`. This module previously duplicated
 * them with a slightly different `isAdmin` (it also accepted the
 * `Administrator` permission and handled null members). To preserve every
 * existing caller's behaviour while collapsing to a single source of truth,
 * this file:
 *
 *   - re-exports `isOwner`, `isMod`, `isStaff`, `hasPermission` from the
 *     canonical module (those have identical behaviour), and
 *   - defines its OWN `isAdmin(member)` that is the UNION of both old
 *     implementations: returns false for null/undefined members, checks
 *     owners, checks the `Administrator` permission, then checks adminRoles.
 *
 * This means callers that imported `isAdmin` from `utils/permissions.ts`
 * keep the stricter Administrator-aware behaviour they relied on, while
 * callers that import from `systems/security/permissions.ts` get the
 * role-only check. Both now share the canonical `isOwner`/`isMod`/etc.
 */

import type { GuildMember } from "discord.js";
import { owners, adminRoles } from "../config.js";

// Re-export the canonical implementations whose behaviour is identical.
export { isOwner, isMod, isStaff, hasPermission } from "../systems/security/permissions.js";

/**
 * Returns true if `member` is a bot owner, has the Discord Administrator
 * permission, OR holds one of the configured admin roles. Returns false for
 * null/undefined members (DMs, uncached).
 */
export function isAdmin(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  if (owners.includes(member.id)) return true;
  if (member.permissions?.has("Administrator")) return true;
  return adminRoles.some((id) => member.roles?.cache?.has(id));
}
