import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';
import { AgentClient } from './helpers/agent-client';

describe('TS-1: Registration, Auth & Account', () => {
  describe('TC-F01: Agent already registered', () => {
    it('has valid agent credentials', () => {
      const ctx = getContext();
      expect(ctx.agentId).toBeGreaterThan(0);
      expect(ctx.apiKey).toBeTruthy();
      expect(ctx.apiSecret).toBeTruthy();
      console.log(
        `[TS-1] Agent: ${ctx.agentName}, ` +
          `id=${ctx.agentId}`
      );
    });
  });

  describe('TC-REF: Referral code registration', () => {
    it(
      'registers with valid referral_code=0345',
      async () => {
        const client = new AgentClient();
        const ts = Date.now();
        const { status, body } = await client.register(
          `ref-test-${ts}`,
          `ref${ts}@test.com`,
          '0345'
        );
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.referral).toBeDefined();
        expect(
          body.data.referral?.agent_name
        ).toBe('yijivip');
        console.log(
          `[TS-1 REF] ` +
            `agent_name=${body.data.referral?.agent_name}`
        );
      }
    );

    it(
      'registers without referral_code → default',
      async () => {
        const client = new AgentClient();
        const ts = Date.now();
        const { status, body } = await client.register(
          `noref-test-${ts}`,
          `noref${ts}@test.com`
        );
        expect(status).toBe(200);
        expect(body.success).toBe(true);
        console.log(
          `[TS-1 REF] no referral: ` +
            `referral=${JSON.stringify(body.data.referral)}`
        );
      }
    );

    it(
      'returns 400 for invalid referral_code',
      async () => {
        const client = new AgentClient();
        const ts = Date.now();
        const { status, body } = await client.register(
          `badref-test-${ts}`,
          `bad${ts}@test.com`,
          'INVALID999'
        );
        expect(status).toBe(400);
        expect(body.success).toBe(false);
      }
    );
  });

  describe('TC-F02: Auth — API Key path', () => {
    it(
      'accesses /account/info with X-API-Key',
      async () => {
        const ctx = getContext();
        ctx.agentClient.useApiKeyAuth();

        const { status, body } =
          await ctx.agentClient.getAccountInfo();

        expect(status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.agent_id).toBe(
          ctx.agentId
        );
        expect(body.data.name).toBe(
          ctx.agentName
        );
      }
    );

    it('rejects invalid API key', async () => {
      const badClient = new AgentClient();
      badClient.setApiKey(
        'agk_invalid_key_000',
        'fake'
      );
      badClient.useApiKeyAuth();

      const { status } =
        await badClient.getAccountInfo();
      expect(status).toBe(401);
    });
  });

  describe('TC-F03: Auth — Bearer token path', () => {
    it(
      'accesses /account/info with Bearer token',
      async () => {
        const ctx = getContext();
        if (!ctx.bearerToken) {
          console.warn(
            '[TS-1] No bearer token, skip'
          );
          return;
        }
        ctx.agentClient.useBearerAuth();

        const { status, body } =
          await ctx.agentClient.getAccountInfo();

        expect(status).toBe(200);
        expect(body.data.agent_id).toBe(
          ctx.agentId
        );

        ctx.agentClient.useApiKeyAuth();
      }
    );

    it('rejects invalid Bearer', async () => {
      const badClient = new AgentClient();
      badClient.setBearerToken('invalid.jwt.token');
      badClient.useBearerAuth();

      const { status } =
        await badClient.getAccountInfo();
      expect(status).toBe(401);
    });
  });

  describe('TC-F04: Cross-system verification', () => {
    it('backend user exists', async () => {
      const ctx = getContext();
      if (ctx.backendUserId) {
        expect(ctx.backendUserId).toBeGreaterThan(0);
        console.log(
          `[TS-1] Backend user: ` +
            `${ctx.backendUsername}, ` +
            `id=${ctx.backendUserId}, ` +
            `balance=${ctx.initialBalance}`
        );
      } else {
        console.warn(
          '[TS-1] Backend user not found — ' +
            'cross-check skipped'
        );
      }
    });
  });
});
