/**
 * Canonical command-cooldown tracker.
 *
 * Single in-memory cooldown module for the whole bot (H-11 architecture
 * cleanup; the duplicate `src/utils/cooldown.ts` now re-exports this).
 *
 * API:
 *   - `setCooldown(commandName, userId, cooldownMs): void`
 *   - `getCooldown(commandName, userId): number`  — ms remaining (0 = none)
 *   - `hasCooldown(commandName, userId): boolean` — convenience: remaining > 0
 *   - `clearCooldown(commandName, userId): void`
 *   - `clearAllCooldowns(userId): void`
 *
 * Note (H-01): this module is intentionally passive — it does NOT decide
 * WHEN to call `setCooldown`. The fix that places the cooldown AFTER a
 * successful command execution lives in `events/interactionCreate.ts`.
 */

const cooldowns = new Map<string, Map<string, number>>();

/** Records a cooldown for `userId` on `commandName` that expires after `cooldownMs`. */
export function setCooldown(
  commandName: string,
  userId: string,
  cooldownMs: number
): void {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }
  cooldowns.get(commandName)!.set(userId, Date.now() + cooldownMs);
}

/** Returns the ms remaining on `userId`'s cooldown for `commandName` (0 if expired/none). */
export function getCooldown(commandName: string, userId: string): number {
  const commandCooldowns = cooldowns.get(commandName);
  if (!commandCooldowns) return 0;

  const expiration = commandCooldowns.get(userId);
  if (!expiration) return 0;

  const remaining = expiration - Date.now();
  if (remaining <= 0) {
    commandCooldowns.delete(userId);
    return 0;
  }

  return remaining;
}

/** Convenience: true if `userId` is currently on cooldown for `commandName`. */
export function hasCooldown(commandName: string, userId: string): boolean {
  return getCooldown(commandName, userId) > 0;
}

/** Removes the cooldown entry for `userId` on `commandName` (if any). */
export function clearCooldown(commandName: string, userId: string): void {
  const commandCooldowns = cooldowns.get(commandName);
  if (commandCooldowns) {
    commandCooldowns.delete(userId);
  }
}

/** Removes every cooldown entry for `userId` across all commands. */
export function clearAllCooldowns(userId: string): void {
  for (const commandCooldowns of cooldowns.values()) {
    commandCooldowns.delete(userId);
  }
}
