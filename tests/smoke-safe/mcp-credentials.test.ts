import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIALS_NOTE,
  getSessionApiPath,
  rotateSessionApiPath,
} from '../../mcp/src/session-request';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function toolBlock(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`server.tool('${name}'`);
  const end = source.indexOf(`server.tool('${nextName}'`);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('MCP include_credentials contract', () => {
  const mcp = read('mcp/src/index.ts');
  const create = toolBlock(mcp, 'nexalayer_create_session', 'nexalayer_get_session');
  const getSession = toolBlock(mcp, 'nexalayer_get_session', 'nexalayer_rotate_session');
  const rotate = toolBlock(mcp, 'nexalayer_rotate_session', 'nexalayer_terminate_session');

  it('states that credentials are omitted unless requested', () => {
    expect(CREDENTIALS_NOTE).toBe(
      'Credentials are omitted unless include_credentials=true; never log them.',
    );
    for (const block of [create, getSession, rotate]) {
      expect(block).toContain('${CREDENTIALS_NOTE}');
    }
  });

  it('does not send include_credentials on create because POST /sessions ignores it', () => {
    expect(create).toContain('does not honor include_credentials');
    expect(create).toContain('PRICE_MISMATCH (409: re-read prices, retry once)');
    expect(create).toContain(
      "BUDGET_EXCEEDED and INSUFFICIENT_BALANCE (402: ask the owner, don't retry)",
    );
    expect(create).not.toContain('include_credentials:');
    expect(create).toContain("api('POST', '/sessions', body, idempotency_key)");
  });

  it('passes include_credentials through on get and rotate, defaulting to false', () => {
    for (const block of [getSession, rotate]) {
      expect(block).toContain('include_credentials: z.boolean().default(false)');
    }
    expect(getSession).toContain('getSessionApiPath(session_id, include_credentials)');
    expect(rotate).toContain('rotateSessionApiPath(session_id, include_credentials)');
    expect(getSessionApiPath('ses/1', false)).toBe('/sessions/ses%2F1?include_credentials=false');
    expect(getSessionApiPath('ses/1', true)).toBe('/sessions/ses%2F1?include_credentials=true');
    expect(rotateSessionApiPath('ses 1', false)).toBe(
      '/sessions/ses%201/rotate?include_credentials=false',
    );
    expect(rotateSessionApiPath('ses 1', true)).toBe(
      '/sessions/ses%201/rotate?include_credentials=true',
    );
  });

  it('publishes matching 0.1.6 metadata and exclusive static launch pricing', () => {
    for (const path of ['mcp/package.json', 'mcp/server.json', 'mcp/mcpb/manifest.json']) {
      const meta = JSON.parse(read(path)) as { version: string; packages?: { version: string }[] };
      expect(meta.version).toBe('0.1.6');
      if (meta.packages) expect(meta.packages[0]?.version).toBe('0.1.6');
    }
    expect(mcp).toContain("version: '0.1.6'");
    const price = '**$1.43–$5.86/month** (launch pricing, live API authoritative)';
    expect(read('README.md')).toContain(price);
    expect(read('mcp/README.md')).toContain(price);
    expect(read('README.md')).toContain('`PRICE_MISMATCH` (409)');
    expect(read('mcp/README.md')).toContain('`PRICE_MISMATCH`');
    expect(read('mcp/README.md')).toContain("don't retry");
  });
});
