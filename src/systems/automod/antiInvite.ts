/**
 * Anti-invite detection.
 *
 * Fixes C-07 (CRITICAL): the original `INVITE_REGEX` used the `/g` flag with
 * `.test()`. A `/g` regex is stateful — each call to `.test()` advances
 * `lastIndex`, so the SAME input alternated between `true` and `false` on
 * consecutive calls. That meant invites were only detected ~50% of the time.
 *
 * Fix: maintain TWO regex instances:
 *   - `INVITE_REGEX_TEST`    — no `g` flag, used by `containsInvite` (calls `.test()`).
 *   - `INVITE_REGEX_EXTRACT` — `/g` flag,   used by `extractInvites` (calls `.match()`).
 *
 * Both exported function names and signatures are preserved.
 */

// Stateful test regex — NO `g` flag (stateful `/g` + `.test()` is the C-07 bug).
const INVITE_REGEX_TEST =
  /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/i;

// Extraction regex — `/g` flag is correct & required for `.match()` to return all hits.
const INVITE_REGEX_EXTRACT =
  /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

/** Returns true if `content` contains at least one Discord invite link. */
export function containsInvite(content: string): boolean {
  return INVITE_REGEX_TEST.test(content);
}

/** Returns every Discord invite link found in `content` (may be empty). */
export function extractInvites(content: string): string[] {
  const matches = content.match(INVITE_REGEX_EXTRACT);
  return matches ?? [];
}
