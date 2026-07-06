
const EMOJI_LIMIT = 8;
const EMOJI_REGEX = /(?:<a?:[a-zA-Z0-9_]+:\d+>|\p{Extended_Pictographic})/gu;

export function isEmojiSpam(content: string): boolean {
  const matches = content.match(EMOJI_REGEX);
  return matches !== null && matches.length > EMOJI_LIMIT;
}
