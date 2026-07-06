const INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/gi;

export function containsInvite(content: string): boolean {
  return INVITE_REGEX.test(content);
}

export function extractInvites(content: string): string[] {
  const matches = content.match(INVITE_REGEX);
  return matches || [];
}
