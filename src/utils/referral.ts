const PRIME = 7919;
const MOD = 10000;
const CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = CHARS.length;

export function generateReferralCode(
  agentId: number
): string {
  if (!agentId) return '';
  const encoded = (agentId * PRIME) % MOD;
  let result = '';
  let temp = encoded;
  while (temp > 0) {
    result = CHARS[temp % BASE] + result;
    temp = Math.floor(temp / BASE);
  }
  while (result.length < 4) {
    result = CHARS[0] + result;
  }
  return result;
}

export function decodeReferralCode(
  code: string
): number | null {
  if (!code) return null;
  let encoded = 0;
  for (const ch of code) {
    const idx = CHARS.indexOf(ch.toUpperCase());
    if (idx === -1) return null;
    encoded = encoded * BASE + idx;
  }
  for (let i = 1; i < MOD; i++) {
    if ((i * PRIME) % MOD === encoded) return i;
  }
  return null;
}
