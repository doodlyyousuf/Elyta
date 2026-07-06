const MIN_LENGTH = 10;
const CAPS_RATIO = 0.7;

export function isExcessiveCaps(content: string): boolean {
  const letters = content.replace(/[^a-zA-Z]/g, "");
  if (letters.length < MIN_LENGTH) return false;
  const caps = letters.replace(/[^A-Z]/g, "").length;
  return caps / letters.length >= CAPS_RATIO;
}
