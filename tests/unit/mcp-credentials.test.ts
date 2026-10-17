import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIALS_NOTE,
  getSessionApiPath,
  rotateSessionApiPath,
} from '../../mcp/src/session-request';

describe('MCP credential request paths', () => {
  it('uses the exact omission sentence', () => {
    expect(CREDENTIALS_NOTE).toBe(
      'Credentials are omitted unless include_credentials=true; never log them.',
    );
  });

  it('requests credentials only as the literals true and false', () => {
    expect(getSessionApiPath('abc', false)).toBe('/sessions/abc?include_credentials=false');
    expect(getSessionApiPath('abc', true)).toBe('/sessions/abc?include_credentials=true');
    expect(rotateSessionApiPath('id/with space', true)).toBe(
      '/sessions/id%2Fwith%20space/rotate?include_credentials=true',
    );
  });

  it('keeps create off the credential query and wires get and rotate', () => {
    const mcp = readFileSync('mcp/src/index.ts', 'utf8');
    const create = mcp.slice(
      mcp.indexOf("server.tool('nexalayer_create_session'"),
      mcp.indexOf("server.tool('nexalayer_get_session'"),
    );
    expect(create).toContain('does not honor include_credentials');
    expect(create).not.toContain('include_credentials:');
    expect(mcp).toContain('getSessionApiPath(session_id, include_credentials)');
    expect(mcp).toContain('rotateSessionApiPath(session_id, include_credentials)');
  });
});
