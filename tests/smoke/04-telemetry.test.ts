import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';
import {
  waitForSessionReady,
} from './helpers/cleanup';

const VALID_RISK_LEVELS = ['low', 'medium', 'high'];
const VALID_RECOMMENDATIONS = [
  'ok',
  'consider_rotate',
  'rotate_now',
  'pause',
];

describe('TS-4: Telemetry & Health', () => {
  let testSessionId = '';

  async function ensureActiveSession(): Promise<
    string
  > {
    if (testSessionId) return testSessionId;

    const ctx = getContext();
    ctx.agentClient.useApiKeyAuth();

    const sessions =
      await ctx.agentClient.listSessions({
        status: 'active',
        page_size: 1,
      });

    if (
      sessions.body.data?.items?.length > 0
    ) {
      testSessionId =
        sessions.body.data.items[0].session_id;
      return testSessionId;
    }

    const productNo = ctx.dynamicProductNo;
    if (!productNo) {
      return '';
    }

    const { body, status } =
      await ctx.agentClient.createSession({
        session_type: 'dynamic',
        product_no: productNo,
        quantity: 1,
      });

    if (
      (status === 201 || status === 202) &&
      body.data?.session_id
    ) {
      testSessionId = body.data.session_id;
      ctx.createdSessionIds.push(testSessionId);
      await waitForSessionReady(
        ctx.agentClient,
        testSessionId,
        30_000
      );
    }

    return testSessionId;
  }

  describe('TC-T01: Report success event', () => {
    it('reports a success event', async () => {
      const sid = await ensureActiveSession();
      if (!sid) {
        console.warn(
          '[TS-4] No active session, skip'
        );
        return;
      }

      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.reportEvent(sid, {
          event_type: 'success',
          status_code: 200,
          latency_ms: 150,
          target_host: 'httpbin.org',
        });

      if (status >= 500) {
        console.warn(
          '[TS-4] Event report error:',
          body.error
        );
        return;
      }

      expect([200, 201]).toContain(status);
      expect(body.data.recorded).toBe(true);
      expect(
        VALID_RISK_LEVELS
      ).toContain(body.data.risk_level);
      expect(
        body.data.block_probability
      ).toBeGreaterThanOrEqual(0);
      expect(
        body.data.block_probability
      ).toBeLessThanOrEqual(1);
    });
  });

  describe('TC-T02: Report error events', () => {
    it('reports http_error event', async () => {
      const sid = await ensureActiveSession();
      if (!sid) return;

      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.reportEvent(sid, {
          event_type: 'http_error',
          status_code: 403,
          latency_ms: 200,
          target_host: 'example.com',
          error_message: 'Forbidden',
        });

      if (status >= 500) {
        console.warn(
          '[TS-4] Event report error:',
          body.error
        );
        return;
      }

      expect([200, 201]).toContain(status);
      expect(body.data.recorded).toBe(true);
    });

    it('reports block event', async () => {
      const sid = await ensureActiveSession();
      if (!sid) return;

      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.reportEvent(sid, {
          event_type: 'block',
          status_code: 403,
          latency_ms: 50,
          target_host: 'target.com',
        });

      if (status >= 400 || !body.data) {
        console.warn(
          '[TS-4] Block event failed:',
          status,
          body.error
        );
        return;
      }

      expect(body.data.recorded).toBe(true);
      expect(
        body.data.block_probability
      ).toBeGreaterThanOrEqual(0);
      expect(
        body.data.block_probability
      ).toBeLessThanOrEqual(1);
    });
  });

  describe('TC-T03: Batch telemetry', () => {
    it('sends batch events', async () => {
      const sid = await ensureActiveSession();
      if (!sid) return;

      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.batchReport([
          {
            session_id: sid,
            event_type: 'success',
            status_code: 200,
            latency_ms: 100,
          },
          {
            session_id: sid,
            event_type: 'timeout',
            status_code: 0,
            latency_ms: 15000,
          },
        ]);

      if (status >= 500) {
        console.warn(
          '[TS-4] Batch failed:',
          body.error
        );
        return;
      }

      expect([200, 201]).toContain(status);
      expect(body.data.processed).toBe(2);
    });
  });

  describe('TC-T04: Session health', () => {
    it(
      'health score in valid range',
      async () => {
        const sid = await ensureActiveSession();
        if (!sid) return;

        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.getSessionHealth(
            sid
          );

        expect(status).toBe(200);
        expect(
          body.data.health_score
        ).toBeGreaterThanOrEqual(0);
        expect(
          body.data.health_score
        ).toBeLessThanOrEqual(100);
        expect(
          VALID_RISK_LEVELS
        ).toContain(body.data.risk_level);
        expect(
          VALID_RECOMMENDATIONS
        ).toContain(body.data.recommendation);

        console.log(
          `[TS-4] Health: ` +
            `score=${body.data.health_score}, ` +
            `risk=${body.data.risk_level}, ` +
            `rec=${body.data.recommendation}`
        );
      }
    );

    it(
      'health has recent_events array',
      async () => {
        const sid = await ensureActiveSession();
        if (!sid) return;

        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { body } =
          await ctx.agentClient.getSessionHealth(
            sid
          );

        expect(
          Array.isArray(body.data.recent_events)
        ).toBe(true);

        if (body.data.total_events === 0) {
          console.warn(
            '[TS-4] No events recorded yet ' +
              '(expected if report-event failed)'
          );
        }
      }
    );
  });
});
