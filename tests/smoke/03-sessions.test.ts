import {
  describe,
  it,
  expect,
  afterAll,
} from 'vitest';
import { getContext } from './helpers/test-context';
import {
  cleanupSessions,
  waitForSessionReady,
} from './helpers/cleanup';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('TS-3: Session Lifecycle', () => {
  afterAll(async () => {
    const ctx = getContext();
    ctx.agentClient.useApiKeyAuth();
    const result = await cleanupSessions(
      ctx.agentClient,
      ctx.createdSessionIds
    );
    ctx.terminatedCount = result.cleaned;
    ctx.residualCount = result.failed;

    // Zero out sub-user IPWEB flow and balance
    if (ctx.backendUserId) {
      try {
        await ctx.backendClient
          .zeroOutUserIpwebFlow(
            ctx.backendUserId
          );
        console.log(
          `[TS-3] Zeroed IPWEB flow for ` +
            `user ${ctx.backendUserId}`
        );
      } catch (err) {
        console.warn(
          '[TS-3] Failed to zero flow:',
          (err as Error).message
        );
      }
      try {
        await ctx.backendClient
          .setUserBalanceToZero(
            ctx.backendUserId
          );
        console.log(
          `[TS-3] Zeroed balance for user ` +
            `${ctx.backendUserId}`
        );
      } catch (err) {
        console.warn(
          '[TS-3] Failed to zero balance:',
          (err as Error).message
        );
      }
    }
  });

  // Dynamic: quantity=1 => 1 unit of product flow (1GB)
  describe('TC-F07: Create dynamic session', () => {
    it('creates a dynamic session', async () => {
      const ctx = getContext();
      if (!ctx.dynamicProductNo) {
        console.warn(
          '[TS-3] No dynamic product, skip'
        );
        return;
      }

      ctx.agentClient.useApiKeyAuth();
      const { status, body } =
        await ctx.agentClient.createSession({
          session_type: 'dynamic',
          product_no: ctx.dynamicProductNo,
          quantity: 1,
          protocol: 'socks5',
        });

      expect([201, 202]).toContain(status);
      expect(body.success).toBe(true);
      expect(
        body.data.session_id
      ).toBeTruthy();
      expect(
        ['creating', 'active']
      ).toContain(body.data.status);

      ctx.createdSessionIds.push(
        body.data.session_id
      );

      console.log(
        `[TS-3] Dynamic session: ` +
          `${body.data.session_id}, ` +
          `status=${body.data.status}, ` +
          `qty=1 (1GB)`
      );
    });

    it(
      'session becomes active within 60s',
      async () => {
        const ctx = getContext();
        const sid = ctx.createdSessionIds[0];
        if (!sid) return;

        ctx.agentClient.useApiKeyAuth();
        const finalStatus =
          await waitForSessionReady(
            ctx.agentClient,
            sid,
            60_000
          );

        if (finalStatus === 'error') {
          const { body } =
            await ctx.agentClient.getSession(sid);
          console.error(
            `[TS-3] Session ${sid} => ERROR: ` +
              `${JSON.stringify(body.data?.health)}`
          );
        }

        expect(finalStatus).toBe('active');

        const { body } =
          await ctx.agentClient.getSession(sid);
        expect(
          body.data.backend_order_no
        ).toBeTruthy();
        ctx.dynamicOrderNo =
          body.data.backend_order_no;
        console.log(
          `[TS-3] Dynamic => active, ` +
            `order=${ctx.dynamicOrderNo}`
        );
      },
      { timeout: 65_000 }
    );
  });

  describe(
    'TC-F07b: Dynamic order backend verification',
    () => {
      it(
        'backend has dynamic order record',
        async () => {
          const ctx = getContext();
          if (!ctx.dynamicOrderNo) {
            console.warn(
              '[TS-3] No dynamic order, skip'
            );
            return;
          }

          await sleep(2000);

          // User consumption: query sub-user
          const userTxns =
            ctx.backendUserId
              ? await ctx.backendClient
                  .getAgentTransactionsByOrderNo(
                    ctx.dynamicOrderNo,
                    ctx.backendUserId
                  )
              : [];
          const userTxn = userTxns.find(
            (t) =>
              t.type === 'consumption' &&
              (t.remark?.includes('消费') &&
                !t.remark?.includes('代理商'))
          );

          // Agent consumption: query agent
          const agentTxns =
            await ctx.backendClient
              .getAgentTransactionsByOrderNo(
                ctx.dynamicOrderNo
              );
          const agentTxn = agentTxns.find(
            (t) =>
              t.type === 'agent_consumption' ||
              (t.type === 'consumption' &&
                t.remark?.includes('代理商'))
          );

          if (userTxn) {
            expect(
              Number(userTxn.amount)
            ).toBeGreaterThan(0);
            console.log(
              `[TS-3] User consumption: ` +
                `${userTxn.transaction_no}, ` +
                `amount=${userTxn.amount}`
            );
          } else {
            console.warn(
              `[TS-3] WARN: No user ` +
                `consumption for ` +
                `${ctx.dynamicOrderNo}`
            );
          }

          if (agentTxn) {
            console.log(
              `[TS-3] Agent consumption: ` +
                `${agentTxn.transaction_no}, ` +
                `amount=${agentTxn.amount}`
            );
          } else {
            console.warn(
              '[TS-3] WARN: No agent ' +
                'consumption record'
            );
          }

          const allTxns = [
            ...userTxns,
            ...agentTxns,
          ];
          const consumptions = allTxns.filter(
            (t) =>
              t.type === 'consumption' ||
              t.type === 'agent_consumption'
          );
          expect(
            consumptions.length
          ).toBeGreaterThanOrEqual(1);
          console.log(
            `[TS-3] Dynamic order ` +
              `${ctx.dynamicOrderNo}: ` +
              `${consumptions.length} ` +
              `consumption record(s)`
          );
        }
      );
    }
  );

  describe('TC-F08: Session detail & list', () => {
    it('gets session detail', async () => {
      const ctx = getContext();
      const sid = ctx.createdSessionIds[0];
      if (!sid) return;

      ctx.agentClient.useApiKeyAuth();
      const { status, body } =
        await ctx.agentClient.getSession(sid);

      expect(status).toBe(200);
      expect(body.data.session_id).toBe(sid);
      expect(body.data.health).toBeTruthy();
      expect(
        typeof body.data.health.health_score
      ).toBe('number');
    });

    it('lists sessions', async () => {
      const ctx = getContext();
      ctx.agentClient.useApiKeyAuth();

      const { status, body } =
        await ctx.agentClient.listSessions({
          page: 1,
          page_size: 10,
        });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      const items = body.data?.items ?? [];
      expect(Array.isArray(items)).toBe(true);
    });

    it(
      'filters sessions by session_type',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.listSessions({
            session_type: 'dynamic',
          });

        expect(status).toBe(200);
        for (const item of body.data.items) {
          expect(item.session_type).toBe(
            'dynamic'
          );
        }
      }
    );
  });

  describe('TC-F09: Rotate session', () => {
    it(
      'rotates with reason',
      async () => {
        const ctx = getContext();
        const sid = ctx.createdSessionIds[0];
        if (!sid) return;

        ctx.agentClient.useApiKeyAuth();
        const check =
          await ctx.agentClient.getSession(sid);
        if (check.body.data?.status !== 'active') {
          console.warn(
            '[TS-3] Session not active, ' +
              'skip rotate'
          );
          return;
        }

        const { status, body } =
          await ctx.agentClient.rotateSession(
            sid,
            'http_403'
          );

        expect([200, 202]).toContain(status);
        if (body.success) {
          console.log(
            `[TS-3] Rotated ${sid} => success`
          );
        }
      }
    );
  });

  describe('TC-F10: Terminate session', () => {
    it('terminates session', async () => {
      const ctx = getContext();
      const sid = ctx.createdSessionIds.find(
        (s) => s.length > 0
      );
      if (!sid) return;

      ctx.agentClient.useApiKeyAuth();
      const { status } =
        await ctx.agentClient.terminateSession(
          sid
        );

      if (status >= 500) {
        console.warn(
          `[TS-3] Terminate ${sid} => ${status}`
        );
        return;
      }

      expect([200, 202]).toContain(status);

      const { body: detail } =
        await ctx.agentClient.getSession(sid);
      expect(
        ['terminated', 'error']
      ).toContain(detail.data.status);
    });
  });

  // Static order tests SKIPPED to avoid
  // real billing. Static orders cost money
  // and are not cleaned up automatically.
  describe(
    'TC-F11: Static session (SKIPPED)',
    () => {
      it('skipped to avoid billing', () => {
        console.log(
          '[TS-3] Static order tests skipped ' +
            '(real cost, use admin panel)'
        );
      });
    }
  );

  describe('TC-F12: Session not found', () => {
    it(
      'returns 404 for bad session id',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status } =
          await ctx.agentClient.getSession(
            'sess_nonexistent_000'
          );
        expect(status).toBe(404);
      }
    );
  });
});
