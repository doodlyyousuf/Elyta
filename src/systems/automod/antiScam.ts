
const SCAM_PATTERNS: RegExp[] = [
  // Free Nitro scams
  /free\s+discord\s*nitro/i,
  /discord\s*nitro\s+for\s+free/i,
  /claim\s+your?\s+nitro/i,
  /nitro\s+gift\s+link/i,

  // Steam gift scams
  /free\s+steam\s+gift/i,
  /steam\s+community\s*\.?\s*ru/i,
  /steam\s+gift\s+card/i,
  /steamnltro/i,

  // "You have been gifted" patterns
  /you\s+(have\s+)?been\s+gifted/i,
  /you\s+won\s+a?\s*(free\s+)?subscription/i,
  /gift\s+from\s+a?\s*friend/i,

  // Fake verification links
  /verify\s+your\s+account\s+at/i,
  /account\s+verification\s+required/i,
  /confirm\s+your\s+identity\s+at/i,

  // Suspicious shortened URLs and scam domains
  /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|is\.gd|t\.co|rb\.gy|shorturl\.at|cutt\.ly)\/\S+/i,
  /(?:https?:\/\/)?discord(?:app)?\.(?:com\/gifts?|gg)\/\S*(?:nitro|free|gift)\S*/i,
  /(?:https?:\/\/)?d[il1]sc[o0]rd[\w-]*\.(?:com|gg|gift|info|org|ru)\b/i,

  // Generic giveaway scams
  /(?:click|visit)\s+(?:this\s+)?link\s+to\s+(?:claim|get|receive)/i,
  /airdrop\s+(?:giveaway|claim)/i,
  /@everyone\s+.*(?:nitro|gift|free|claim|airdrop)/i,
];

export function isScamMessage(content: string): boolean {
  return SCAM_PATTERNS.some((pattern) => pattern.test(content));
}
