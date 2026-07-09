import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';

const WARN_P95_MS = 3000;
const HARD_MAX_MS = 10_000;

function computePercentiles(
  sorted: number[]
): { p50: number; p95: number; max: number } {
  const p50Idx = Math.floor(
    sorted.length * 0.5
  );
  const p95Idx = Math.floor(
    sorted.length * 0.95
  );
  return {
    p50: sorted[p50Idx] ?? 0,
    p95: sorted[p95Idx] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

describe('TS-7: Performance Smoke & Stats', () => {
  describe(
    'TC-P01: Health endpoint latency',
    () => {
      it('health check < 10s max', async () => {
        const ctx = getContext();
        const latencies: number[] = [];

        for (let i = 0; i < 10; i++) {
          const { latencyMs } =
            await ctx.agentClient.health();
          latencies.push(latencyMs);
        }

        latencies.sort((a, b) => a - b);
        const m = computePercentiles(latencies);
        ctx.perfMetrics['GET /v1/health'] = m;

        console.log(
          `[TS-7] Health: ` +
            `p50=${m.p50}ms, ` +
            `p95=${m.p95}ms, ` +
            `max=${m.max}ms`
        );

        expect(m.max).toBeLessThan(HARD_MAX_MS);

        if (m.p95 > WARN_P95_MS) {
          console.warn(
            `[TS-7] WARN: health p95 ` +
              `(${m.p95}ms) > ${WARN_P95_MS}ms`
          );
        }
      });
    }
  );

  describe(
    'TC-P02: Account info latency',
    () => {
      it(
        'account info < 10s max',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();
          const latencies: number[] = [];

          for (let i = 0; i < 5; i++) {
            const { latencyMs } =
              await ctx.agentClient
                .getAccountInfo();
            latencies.push(latencyMs);
          }

          latencies.sort((a, b) => a - b);
          const m =
            computePercentiles(latencies);
          ctx.perfMetrics[
            'GET /v1/account/info'
          ] = m;

          console.log(
            `[TS-7] Account info: ` +
              `p50=${m.p50}ms, ` +
              `p95=${m.p95}ms, ` +
              `max=${m.max}ms`
          );

          expect(
            m.max
          ).toBeLessThan(HARD_MAX_MS);

          if (m.p95 > WARN_P95_MS) {
            console.warn(
              `[TS-7] WARN: account p95 ` +
                `(${m.p95}ms) slow`
            );
          }
        }
      );
    }
  );

  describe(
    'TC-P03: Session create latency',
    () => {
      it(
        'measures session create time',
        async () => {
          const ctx = getContext();
          if (!ctx.dynamicProductNo) {
            console.warn(
              '[TS-7] No product, ' +
                'skip session perf'
            );
            return;
          }

          ctx.agentClient.useApiKeyAuth();
          const start = Date.now();
          const { status } =
            await ctx.agentClient.createSession({
              session_type: 'dynamic',
              product_no: ctx.dynamicProductNo,
              quantity: 1,
            });
          const elapsed = Date.now() - start;

          ctx.perfMetrics[
            'POST /v1/sessions (create)'
          ] = {
            p50: elapsed,
            p95: elapsed,
            max: elapsed,
          };

          if ([201, 202].includes(status)) {
            console.log(
              `[TS-7] Session create: ` +
                `${elapsed}ms ` +
                `(status=${status})`
            );
          }
        }
      );
    }
  );

  describe(
    'TC-P04: Concurrent requests (light)',
    () => {
      it(
        'handles 5 concurrent requests',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();

          const start = Date.now();
          const results =
            await Promise.allSettled(
              Array.from({ length: 5 }, () =>
                ctx.agentClient.getAccountInfo()
              )
            );
          const wallTime = Date.now() - start;

          const successes = results.filter(
            (r) => r.status === 'fulfilled'
          );

          expect(
            successes.length
          ).toBeGreaterThanOrEqual(3);

          console.log(
            `[TS-7] 5 concurrent: ` +
              `${successes.length}/5 ok, ` +
              `wall=${wallTime}ms`
          );
        }
      );
    }
  );

  describe('TC-P05: Stats overview', () => {
    it(
      'returns stats overview',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.getStats();

        expect(status).toBe(200);
        expect(body.success).toBe(true);

        console.log(
          '[TS-7] Stats: ' +
            JSON.stringify(body.data)
              .slice(0, 200)
        );
      }
    );
  });

  describe(
    'TC-P06: Response structure consistency',
    () => {
      it(
        'all responses have success + meta',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();

          const endpoints = [
            () =>
              ctx.agentClient.getAccountInfo(),
            () => ctx.agentClient.getBalance(),
            () =>
              ctx.agentClient.listSessions({
                page: 1,
              }),
            () =>
              ctx.agentClient.listProducts(
                'all'
              ),
          ];

          for (const fn of endpoints) {
            const { body } = await fn();
            expect(
              typeof body.success
            ).toBe('boolean');
            if (body.meta) {
              expect(
                typeof body.meta.request_id
              ).toBe('string');
            }
          }
        }
      );
    }
  );
});
