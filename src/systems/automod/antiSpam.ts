const tracker = new Map<string, { count: number; last: number }>();
const WINDOW = 5000;
const LIMIT = 5;

export function isSpamming(userId: string, _message: any): boolean {
  const now = Date.now();
  const entry = tracker.get(userId) || { count: 0, last: now };
  if (now - entry.last > WINDOW) entry.count = 0;
  entry.count++;
  entry.last = now;
  tracker.set(userId, entry);
  return entry.count > LIMIT;
}
