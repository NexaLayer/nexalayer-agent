// Server-side redaction applied to anything a reporter sends us (tickets)
// and anything we send to the owner (ops alerts). Proxy credentials,
// full_url, API keys, and secrets must never be stored or echoed.

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /^(full_?url|proxy_?url|password|passwd|pass|pwd|secret|api_?key|x-api-key|apikey|api_?secret|token|access_?token|auth|authorization|credentials?|username|proxy_?username|proxy_?password|cookie|private_?key)$/i;

const PATTERNS: RegExp[] = [
  // scheme://user:pass@host (proxy URLs, DSNs)
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@[^\s"'<>]+/gi,
  // NexaLayer / common key formats
  /\b(?:ak|sk|agk|nlk)_[A-Za-z0-9]{16,}\b/g,
  // Telegram bot tokens
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g,
  // Bearer tokens / JWTs
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // key=value / key: value pairs naming a secret
  /\b(password|passwd|pwd|secret|api[_-]?key|x-api-key|token|full_url)\b(\s*["']?\s*[:=]\s*["']?)([^\s"',;&}]+)/gi,
  // host:port:user:pass proxy lines
  /\b[\w.-]+\.[a-z]{2,}:\d{2,5}:[^\s:]+:[^\s:]+\b/gi,
];

export function redactString(input: string): { value: string; count: number } {
  let count = 0;
  let value = input;
  for (const pattern of PATTERNS) {
    value = value.replace(pattern, (...args: unknown[]) => {
      count += 1;
      // key=value form keeps the key name so the reporter learns what was removed.
      if (typeof args[1] === 'string' && typeof args[2] === 'string' && typeof args[3] === 'string') {
        return `${args[1]}${args[2]}${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return { value, count };
}

/** Deep-redact any JSON-like value. Returns a new value and the number of redactions. */
export function redactDeep<T>(input: T): { value: T; count: number } {
  let count = 0;
  const walk = (node: unknown, depth: number): unknown => {
    if (depth > 8) return null;
    if (typeof node === 'string') {
      const r = redactString(node);
      count += r.count;
      return r.value;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, depth + 1));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(key) && val !== null && val !== undefined && val !== '') {
          out[key] = REDACTED;
          count += 1;
        } else {
          out[key] = walk(val, depth + 1);
        }
      }
      return out;
    }
    return node;
  };
  const value = walk(input, 0) as T;
  return { value, count };
}
