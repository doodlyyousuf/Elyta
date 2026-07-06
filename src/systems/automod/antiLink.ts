
const URL_REGEX = /https?:\/\/[^\s]+/i;

export function containsLink(content: string): boolean {
  return URL_REGEX.test(content);
}

export function containsInvite(content: string): boolean {
  return /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(content);
}
