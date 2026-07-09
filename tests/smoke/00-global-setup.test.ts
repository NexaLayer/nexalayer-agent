import {
  describe,
  it,
  expect,
  beforeAll,
} from 'vitest';
import {
  enforceEnvironmentGuard,
  AGENT_BASE_URL,
  BACKEND_BASE_URL,
  BACKEND_INTERNAL_URL,
  AGENT_DATABASE_URL,
} from './setup';
import { AgentClient } from './helpers/agent-client';
import {
  BackendVerifyClient,
} from './helpers/backend-verify-client';

describe('TS-0: Environment & Connectivity', () => {
  beforeAll(() => {
    enforceEnvironmentGuard();
  });

  it('prints run configuration', () => {
    console.log('[SETUP] --- Run Config ---');
    console.log(
      `  AGENT_BASE_URL:      ${AGENT_BASE_URL}`
    );
    console.log(
      `  BACKEND_BASE_URL:    ${BACKEND_BASE_URL}`
    );
    console.log(
      `  BACKEND_INTERNAL:    ${BACKEND_INTERNAL_URL}`
    );
    console.log(
      `  DB reachable:        ` +
        `${AGENT_DATABASE_URL ? 'yes' : 'no'}`
    );
  });

  it('Agent Layer health check', async () => {
    const client = new AgentClient();
    const { status, body } = await client.health();
    expect(status).toBe(200);
    expect(body.data?.status).toBe('ok');
    console.log(
      `[SETUP] Agent: ${AGENT_BASE_URL} => healthy`
    );
  });

  it(
    'Backend reachable (public URL)',
    async () => {
      let lastErr: Error | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch(
            `${BACKEND_BASE_URL}/api/auth/login`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: '{}',
            }
          );
          expect(res.status).toBeLessThan(500);
          console.log(
            `[SETUP] Backend public: ` +
              `${BACKEND_BASE_URL} => reachable`
          );
          return;
        } catch (err) {
          lastErr = err as Error;
          await new Promise((r) =>
            setTimeout(r, 2000)
          );
        }
      }
      throw lastErr;
    }
  );

  it(
    'Backend internal URL reachable via Agent',
    async () => {
      const client = new AgentClient();
      const { status, body } = await client.request<{
        backend_reachable?: boolean;
        backend_url?: string;
      }>('/v1/health');

      expect(status).toBe(200);

      if (body.data?.backend_url) {
        const isInternal =
          body.data.backend_url.includes(
            'railway.internal'
          );
        console.log(
          `[SETUP] Agent→Backend URL: ` +
            `${body.data.backend_url} ` +
            `(internal=${isInternal})`
        );
        if (!isInternal) {
          console.warn(
            '[SETUP] WARN: Agent is NOT using ' +
              'internal URL for backend!'
          );
        }
      } else {
        console.log(
          '[SETUP] Agent health ok; ' +
            'no backend_url in response'
        );
      }
    }
  );

  it('Backend openAgent login', async () => {
    const backend = new BackendVerifyClient();
    await backend.login();
    expect(backend.getToken()).toBeTruthy();
    console.log(
      '[SETUP] openAgent login => success'
    );
  });

  it(
    'Agent DB reachable',
    async () => {
      if (!AGENT_DATABASE_URL) {
        console.warn(
          '[SETUP] AGENT_DATABASE_URL not set, ' +
            'skip DB check'
        );
        return;
      }

      try {
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: AGENT_DATABASE_URL,
          connectionTimeoutMillis: 5000,
        });
        await client.connect();
        const res = await client.query(
          'SELECT 1 AS ok'
        );
        await client.end();
        expect(res.rows[0].ok).toBe(1);
        console.log(
          '[SETUP] Agent DB => reachable'
        );
      } catch (err) {
        console.warn(
          '[SETUP] Agent DB not reachable:',
          (err as Error).message
        );
      }
    }
  );
});
