import { describe, expect, it } from 'vitest';

describe('session list credential redaction contract', () => {
  it('uses credential-free formatting for list responses', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/modules/session/session.service.ts', 'utf8')
    );
    expect(source).toContain('sessions.map((session) => formatSession(session, false))');
    expect(source).toContain('includeCredentials ? buildProxyUrl(session) : undefined');
    expect(source).toContain('const formatted = formatSession(session, true)');
  });
});
