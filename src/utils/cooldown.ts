const cooldowns = new Map<string, number>();

export function onCooldown(userId: string, command: string, seconds: number): boolean {
  const key = `${userId}:${command}`;
  const now = Date.now();
  const expires = cooldowns.get(key);
  if (expires && now < expires) return true;
  cooldowns.set(key, now + seconds * 1000);
  return false;
}
