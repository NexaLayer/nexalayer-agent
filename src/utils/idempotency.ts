import { createHash } from 'crypto';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(object[key])}`
    ).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashIdempotentRequest(request: {
  method: string;
  url: string;
  body?: unknown;
}): string {
  return createHash('sha256')
    .update(`${request.method.toUpperCase()}\n${request.url}\n${canonicalJson(request.body ?? null)}`)
    .digest('hex');
}

export function parseResponsePayload(payload: unknown): unknown {
  if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
  if (typeof payload !== 'string') return { raw: String(payload ?? '') };
  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}
