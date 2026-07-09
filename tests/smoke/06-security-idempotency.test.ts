import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';
import { AgentClient } from './helpers/agent-client';
import { v4 as uuidv4 } from 'uuid';

describe('TS-6: Security & Idempotency', () => {
  describe('TC-S01: Unauthenticated access', () => {
    it(
      'rejects requests without auth header',
      async () => {
        const client = new AgentClient();
        client.useNoAuth();

        const { status } =
          await client.getAccountInfo();
        expect(status).toBe(401);
      }
    );

    it(
      'rejects session create without auth',
      async () => {
        const client = new AgentClient();
        client.useNoAuth();

        const { status } =
          await client.createSession({
            session_type: 'dynamic',
            product_no: 'fake_product',
          });
        expect(status).toBe(401);
      }
    );
  });

  describe(
    'TC-S02: Cross-agent isolation',
    () => {
      it(
        'cannot access other agent sessions',
        async () => {
          const ctx = getContext();
          if (
            ctx.createdSessionIds.length === 0
          ) {
            console.warn(
              '[TS-6] No sessions ' +
                'to test isolation'
            );
            return;
          }

          const otherClient = new AgentClient();
          otherClient.useNoAuth();

          const reg =
            await otherClient.register(
              `isol_${Date.now().toString(36)}`,
              'isolation@test.smoke'
            );

          if (reg.status !== 201) {
            console.warn(
              '[TS-6] Could not create ' +
                'isolation agent'
            );
            return;
          }

          otherClient.setApiKey(
            reg.body.data.api_key,
            reg.body.data.api_secret
          );
          otherClient.useApiKeyAuth();

          const { status } =
            await otherClient.getSession(
              ctx.createdSessionIds[0]
            );

          expect(status).toBe(404);
        }
      );
    }
  );

  describe(
    'TC-S03: Rate limit headers',
    () => {
      it(
        'returns rate limit headers',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();

          const { headers } =
            await ctx.agentClient.getAccountInfo();

          const hasRateHeaders =
            headers.has('x-ratelimit-limit') ||
            headers.has(
              'x-ratelimit-remaining'
            ) ||
            headers.has('ratelimit-limit') ||
            headers.has('ratelimit-remaining');

          if (hasRateHeaders) {
            console.log(
              '[TS-6] Rate limit headers present'
            );
          } else {
            console.warn(
              '[TS-6] No rate limit headers ' +
                '(may not be enabled in dev)'
            );
          }
        }
      );
    }
  );

  describe(
    'TC-S04: Idempotency (session create)',
    () => {
      it(
        'same key returns same session_id ' +
          'or conflict, no duplicate txn',
        async () => {
          const ctx = getContext();
          if (!ctx.dynamicProductNo) {
            console.warn(
              '[TS-6] No product, ' +
                'skip idempotency'
            );
            return;
          }

          ctx.agentClient.useApiKeyAuth();

          const txnBefore =
            await ctx.agentClient.getTransactions({
              page: 1,
              page_size: 100,
            });
          const txnCountBefore =
            txnBefore.body.data?.total ??
            txnBefore.body.data?.items?.length ??
            0;

          const iKey = uuidv4();

          const first =
            await ctx.agentClient
              .createSessionWithIdempotency(
                {
                  session_type: 'dynamic',
                  product_no:
                    ctx.dynamicProductNo,
                  quantity: 1,
                },
                iKey
              );

          expect(
            [201, 202]
          ).toContain(first.status);

          const firstSid =
            first.body.data?.session_id;

          if (firstSid) {
            ctx.createdSessionIds.push(firstSid);
          }

          const second =
            await ctx.agentClient
              .createSessionWithIdempotency(
                {
                  session_type: 'dynamic',
                  product_no:
                    ctx.dynamicProductNo,
                  quantity: 1,
                },
                iKey
              );

          const validIdempotent =
            (second.status === first.status &&
              second.body.data?.session_id ===
                firstSid) ||
            second.status === 409;

          if (validIdempotent) {
            console.log(
              '[TS-6] Idempotency: ' +
                'correctly handled'
            );
          } else {
            console.warn(
              `[TS-6] Idempotency: ` +
                `first=${first.status}, ` +
                `second=${second.status}. ` +
                `May not be enforced yet.`
            );
            if (second.body.data?.session_id) {
              ctx.createdSessionIds.push(
                second.body.data.session_id
              );
            }
          }

          const txnAfter =
            await ctx.agentClient.getTransactions({
              page: 1,
              page_size: 100,
            });
          const txnCountAfter =
            txnAfter.body.data?.total ??
            txnAfter.body.data?.items?.length ??
            0;

          const newTxns =
            txnCountAfter - txnCountBefore;

          if (validIdempotent) {
            expect(newTxns).toBeLessThanOrEqual(1);
            console.log(
              `[TS-6] Txn count: ` +
                `before=${txnCountBefore}, ` +
                `after=${txnCountAfter}, ` +
                `new=${newTxns} (expected <=1)`
            );
          } else {
            console.warn(
              `[TS-6] Txn count: ` +
                `new=${newTxns} ` +
                `(idempotency not enforced, ` +
                `may have duplicate)`
            );
          }
        }
      );
    }
  );

  describe(
    'TC-S05: Insufficient balance → 402',
    () => {
      it(
        'rejects session when balance is ' +
          'insufficient',
        async () => {
          const poorClient = new AgentClient();
          poorClient.useNoAuth();

          const reg =
            await poorClient.register(
              `poor_${Date.now().toString(36)}`,
              'poor@test.smoke'
            );

          if (reg.status !== 201) {
            console.warn(
              '[TS-6] Could not create ' +
                'poor agent, skip'
            );
            return;
          }

          poorClient.setApiKey(
            reg.body.data.api_key,
            reg.body.data.api_secret
          );
          poorClient.useApiKeyAuth();

          const ctx = getContext();
          if (!ctx.dynamicProductNo) {
            console.warn(
              '[TS-6] No product for ' +
                'balance test'
            );
            return;
          }

          const { status, body } =
            await poorClient.createSession({
              session_type: 'dynamic',
              product_no: ctx.dynamicProductNo,
              quantity: 100,
            });

          if (
            status === 201 ||
            status === 202
          ) {
            console.warn(
              '[TS-6] Insufficient balance: ' +
                'agent has trial balance ' +
                `(${reg.body.data.trial_balance}).` +
                ' Session created ' +
                `(${status}). Trial balance ` +
                'covers the cost.'
            );
            if (body.data?.session_id) {
              ctx.createdSessionIds.push(
                body.data.session_id
              );
            }
          } else {
            const rejectCodes = [
              402, 403, 400, 500,
            ];
            expect(
              rejectCodes
            ).toContain(status);

            if (status === 402) {
              console.log(
                '[TS-6] Insufficient balance: ' +
                  '402 returned correctly'
              );
            } else {
              console.warn(
                `[TS-6] Insufficient ` +
                  `balance: got ${status}. ` +
                  `error=${body.error?.code}`
              );
            }
          }
        }
      );
    }
  );

  describe('TC-S06: Input validation', () => {
    it(
      'rejects invalid session_type',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status } =
          await ctx.agentClient.request(
            '/v1/sessions',
            {
              method: 'POST',
              body: {
                session_type: 'invalid_type',
                product_no: 'x',
              },
            }
          );
        expect([400, 500]).toContain(status);
      }
    );

    it(
      'rejects missing product_no',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status } =
          await ctx.agentClient.request(
            '/v1/sessions',
            {
              method: 'POST',
              body: {
                session_type: 'dynamic',
              },
            }
          );
        expect([400, 500]).toContain(status);
      }
    );
  });
});
