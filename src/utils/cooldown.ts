/**
 * Backwards-compatible cooldown shim (H-11 architecture cleanup).
 *
 * Previously this was a DUPLICATE, unused cooldown module with a slightly
 * different API (`onCooldown(userId, command, seconds): boolean`). The
 * canonical implementation now lives at
 * `src/systems/security/cooldowns.ts`. To avoid breaking any stray callers
 * that still import from `src/utils/cooldown.ts`, this file delegates to the
 * canonical module and re-exports its API, while keeping the legacy
 * `onCooldown(...)` signature as a thin wrapper.
 */

// Re-export the canonical API so callers that use these names keep compiling.
export {
  getCooldown,
  setCooldown,
  hasCooldown,
  clearCooldown,
  clearAllCooldowns,
} from "../systems/security/cooldowns.js";

import { getCooldown, setCooldown } from "../systems/security/cooldowns.js";

/**
 * Legacy convenience: returns `true` if `userId` is currently on cooldown for
 * `command`; otherwise STARTS a new cooldown of `seconds` seconds and
 * returns `false`.
 *
 * Behaviour note: this both checks and sets, mirroring the old module. The
 * canonical `getCooldown` / `setCooldown` split is preferred for new code
 * (in particular because `interactionCreate` needs to set the cooldown
 * AFTER a successful execution — see H-01).
 */
export function onCooldown(
  userId: string,
  command: string,
  seconds: number
): boolean {
  const remaining = getCooldown(command, userId);
  if (remaining > 0) return true;
  setCooldown(command, userId, seconds * 1000);
  return false;
}
