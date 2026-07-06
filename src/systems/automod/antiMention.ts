
const MENTION_LIMIT = 5;

export function isMentionSpam(content: string, mentionCount: number): boolean {
  if (/@everyone|@here/.test(content)) return true;
  return mentionCount >= MENTION_LIMIT;
}
