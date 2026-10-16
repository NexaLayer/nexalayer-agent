export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
  return `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}
