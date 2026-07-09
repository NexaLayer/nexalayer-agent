import { getContext, initContext } from './test-context';
import { BackendVerifyClient } from './backend-verify-client';

let _ready = false;

export async function ensureReady(): Promise<void> {
  const ctx = initContext();
  if (_ready && ctx.apiKey) return;

  ctx.agentClient.useNoAuth();
  const { status, body } =
    await ctx.agentClient.register(
      ctx.agentName,
      `${ctx.agentName}@test.smoke`
    );

  if (status === 201 && body.success) {
    ctx.agentId = body.data.agent_id;
    ctx.apiKey = body.data.api_key;
    ctx.apiSecret = body.data.api_secret;
    ctx.agentClient.setApiKey(
      ctx.apiKey,
      ctx.apiSecret
    );
  }

  ctx.agentClient.useNoAuth();
  const tokenRes = await ctx.agentClient.getToken();
  if (tokenRes.status === 200 && tokenRes.body.data?.access_token) {
    ctx.bearerToken = tokenRes.body.data.access_token;
    ctx.agentClient.setBearerToken(ctx.bearerToken);
  }

  ctx.agentClient.useApiKeyAuth();

  if (!ctx.dynamicProductNo) {
    try {
      const prodRes =
        await ctx.agentClient.listProducts('all');
      if (
        prodRes.status === 200 &&
        prodRes.body.data?.items
      ) {
        for (const p of prodRes.body.data.items) {
          if (
            p.type === 'dynamic' &&
            !ctx.dynamicProductNo &&
            p.product_no
          ) {
            ctx.dynamicProductNo = p.product_no;
          }
          if (
            p.type === 'static' &&
            !ctx.staticProductNo &&
            p.product_no
          ) {
            ctx.staticProductNo = p.product_no;
          }
        }
      }
    } catch {
      console.warn('[ensureReady] products fetch failed');
    }
  }

  if (!ctx.backendClient.getToken()) {
    await ctx.backendClient.login();
  }

  try {
    const agentBal =
      ctx.backendClient.getAgentBalance();
    if (agentBal < 50) {
      const agentUid =
        ctx.backendClient.getAgentUserId();
      console.log(
        `[ensureReady] openAgent balance ` +
          `${agentBal}, topping up (id=${agentUid})`
      );
      await ctx.backendClient.adjustUserBalance(
        agentUid,
        50,
        'smoke-test agent topup (dynamic only)'
      );
    }
  } catch (err) {
    console.warn(
      '[ensureReady] agent topup failed:',
      (err as Error).message
    );
  }

  if (ctx.agentId && !ctx.backendUserId) {
    const cleaned = ctx.agentName
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .slice(0, 8);
    const username =
      `ag_${cleaned}${ctx.agentId}`;
    const user =
      await ctx.backendClient.getUserByUsername(
        username
      );
    if (user) {
      ctx.backendUsername = user.username;
      ctx.backendUserId = user.id;
    }
  }

  if (ctx.backendUserId) {
    try {
      const result =
        await ctx.backendClient
          .adjustUserBalance(
            ctx.backendUserId,
            50,
            'smoke-test topup (1GB dynamic)'
          );
      console.log(
        `[ensureReady] adjustBalance raw: ` +
          JSON.stringify(result)
      );
      if (result?.balance !== undefined) {
        ctx.initialBalance = result.balance;
        ctx.balanceBefore = result.balance;
      }
      console.log(
        `[ensureReady] Sub-user ` +
          `${ctx.backendUserId} balance: ` +
          `${ctx.initialBalance}`
      );
    } catch (err) {
      console.warn(
        '[ensureReady] user topup failed:',
        String(err)
      );
    }
  }

  _ready = true;
}

declare global {
  // eslint-disable-next-line no-var
  var __smokeReady: boolean;
}

if (!globalThis.__smokeReady) {
  globalThis.__smokeReady = false;
}
