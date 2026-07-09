import {
  describe,
  it,
  expect,
  beforeAll,
} from 'vitest';
import { getContext } from './helpers/test-context';

describe('TS-5: Billing & Balance', () => {
  beforeAll(async () => {
    const ctx = getContext();
    ctx.agentClient.useApiKeyAuth();
    try {
      const { body } =
        await ctx.agentClient.getBalance();
      if (body.data?.balance !== undefined) {
        ctx.balanceBefore = body.data.balance;
      }
    } catch {
      /* ignore */
    }
  });

  describe('TC-B01: Balance query', () => {
    it('returns current balance', async () => {
      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.getBalance();

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(
        typeof body.data.balance
      ).toBe('number');
      expect(
        body.data.balance
      ).toBeGreaterThanOrEqual(0);

      console.log(
        `[TS-5] Balance: ${body.data.balance}`
      );
    });
  });

  describe(
    'TC-B02: Recharge order creation',
    () => {
      it(
        'creates USDT recharge order',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();

          const { status, body } =
            await ctx.agentClient
              .createRechargeOrder(50);

          if (
            status === 502 ||
            status === 500
          ) {
            console.warn(
              '[TS-5] USDT recharge ' +
                'not available: ' +
                JSON.stringify(body.error)
            );
            return;
          }

          expect([200, 201]).toContain(status);
          if (body.success) {
            expect(
              body.data.order_id
            ).toBeTruthy();
            expect(body.data.amount).toBe(50);
            console.log(
              `[TS-5] Recharge order: ` +
                `${body.data.order_id}`
            );
          }
        }
      );
    }
  );

  describe(
    'TC-B03: Transaction history',
    () => {
      it('lists transactions', async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.getTransactions({
            page: 1,
            page_size: 10,
          });

        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(
          Array.isArray(body.data?.items)
        ).toBe(true);

        console.log(
          `[TS-5] Transactions: ` +
            `${body.data?.total ?? body.data?.items?.length ?? 0} total`
        );
      });
    }
  );

  describe(
    'TC-B04: Balance after operations',
    () => {
      it(
        'records final balance for report',
        async () => {
          const ctx = getContext();
          ctx.agentClient.useApiKeyAuth();

          const { body } =
            await ctx.agentClient.getBalance();

          if (body.data?.balance !== undefined) {
            ctx.balanceAfter = body.data.balance;
          }

          const delta =
            ctx.balanceBefore -
            ctx.balanceAfter;

          console.log(
            `[TS-5] Balance: ` +
              `before=${ctx.balanceBefore}, ` +
              `after=${ctx.balanceAfter}, ` +
              `consumed=${delta.toFixed(2)}`
          );
        }
      );
    }
  );
});
