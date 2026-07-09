import { beforeAll, describe, expect, it } from 'vitest';

const AGENT_URL =
  process.env.AGENT_BASE_URL ??
  'https://aiagent-production-9411.up.railway.app';
const BACKEND_URL =
  process.env.BACKEND_BASE_URL ??
  'https://backend-production-127a.up.railway.app';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for this regression test`);
  }
  return value;
}

const ACCOUNTS = {
  admin: [
    process.env.REGRESSION_ADMIN_USERNAME ?? 'admin',
    requiredEnv('REGRESSION_ADMIN_PASSWORD'),
  ],
  agent: [
    process.env.REGRESSION_AGENT_USERNAME ?? 'yijivip',
    requiredEnv('REGRESSION_AGENT_PASSWORD'),
  ],
  user: [
    process.env.REGRESSION_USER_USERNAME ?? 'wenjianhao',
    requiredEnv('REGRESSION_USER_PASSWORD'),
  ],
} as const;

const FIXED_ORDER_NO = 'STA20260317143516qfm434';

interface NLData {
  conversation_id: string;
  intent: string;
  message: string;
  data?: Record<string, unknown>;
}

interface NLResp {
  success: boolean;
  data: NLData;
}

const tokens: Partial<Record<keyof typeof ACCOUNTS, string>> =
  {};

async function login(role: keyof typeof ACCOUNTS) {
  if (tokens[role]) return tokens[role] as string;
  const [username, password] = ACCOUNTS[role];
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  const token = body?.data?.token ?? '';
  tokens[role] = token;
  return token;
}

async function nlExecute(
  token: string,
  message: string,
  conversationId?: string
): Promise<NLData> {
  const payload: Record<string, unknown> = { message };
  if (conversationId) payload.conversation_id = conversationId;
  const res = await fetch(`${AGENT_URL}/v1/nl/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as NLResp;
  return body.data;
}

async function nlQueryTransactions(
  token: string,
  message: string,
  conversationId?: string
): Promise<NLData> {
  const first = await nlExecute(
    token,
    message,
    conversationId
  );
  if (first.intent === 'query_transactions') {
    return first;
  }
  const forced = await nlExecute(
    token,
    `查询交易流水 ${message}`,
    conversationId
  );
  return forced;
}

function matchCount(input: string, reg: RegExp): number {
  const m = input.match(reg);
  return m ? m.length : 0;
}

describe('Transaction display regression', () => {
  beforeAll(async () => {
    const adminToken = await login('admin');
    const agentToken = await login('agent');
    const userToken = await login('user');
    expect(adminToken).not.toBe('');
    expect(agentToken).not.toBe('');
    expect(userToken).not.toBe('');
  }, 30_000);

  it('管理员：默认每页20条 + 字段标签', async () => {
    const token = await login('admin');
    const r = await nlQueryTransactions(
      token,
      '查询交易流水'
    );
    expect(r.intent).toBe('query_transactions');
    expect(r.message).toContain('第 1 页');
    expect(r.message).toContain('用户名：');
    expect(r.message).toContain('消费额：');
    expect(r.message).toContain('备注：');
    expect(r.message).toContain('创建时间：');

    const tx = (r.data?.transactions || []) as Array<unknown>;
    expect(tx.length).toBe(20);
  }, 30_000);

  it('管理员：固定订单可见用户/代理商/管理员三类消费', async () => {
    const token = await login('admin');
    const r = await nlQueryTransactions(
      token,
      `订单号：${FIXED_ORDER_NO}`
    );
    expect(r.intent).toBe('query_transactions');
    expect(r.message).toContain(FIXED_ORDER_NO);
    expect(r.message).toContain('用户名：admin 管理员消费');
    expect(r.message).toContain('用户名：yijivip 代理商消费');
    expect(r.message).toContain('用户消费');
  }, 30_000);

  it('代理商：固定订单不应出现管理员消费记录', async () => {
    const token = await login('agent');
    const r = await nlQueryTransactions(
      token,
      `订单号：${FIXED_ORDER_NO}`
    );
    expect(r.intent).toBe('query_transactions');
    expect(r.message).toContain(FIXED_ORDER_NO);
    expect(r.message).toContain('用户名：yijivip 代理商消费');
    expect(r.message).toContain('用户消费');
    expect(r.message).not.toContain('用户名：admin 管理员消费');
  }, 30_000);

  it('用户：隐藏用户名字段，仅显示本人消费块', async () => {
    const token = await login('user');
    const r = await nlQueryTransactions(
      token,
      '查询交易流水'
    );
    expect(r.intent).toBe('query_transactions');
    expect(r.message).toContain('消费额：');
    expect(r.message).toContain('创建时间：');
    expect(r.message).not.toContain('用户名：');
  }, 30_000);

  it('每条记录按块显示（记录数=创建时间行数）', async () => {
    const token = await login('admin');
    const r = await nlQueryTransactions(
      token,
      '查询交易流水'
    );
    const itemCount = matchCount(r.message, /\n\d+\.\s/g);
    const createdCount = matchCount(
      r.message,
      /创建时间：/g
    );
    expect(itemCount).toBeGreaterThan(0);
    expect(createdCount).toBe(itemCount);
  }, 30_000);

  it('多轮分页：查交易记录 → 下一页 → 查看第2个', async () => {
    const token = await login('admin');
    const p1 = await nlQueryTransactions(
      token,
      '查询交易流水'
    );
    expect(p1.intent).toBe('query_transactions');
    const conv = p1.conversation_id;
    expect(conv).toBeTruthy();

    const p2 = await nlExecute(token, '下一页', conv);
    expect([
      'paginate_next',
      'query_transactions',
    ]).toContain(p2.intent);
    expect(p2.message).toContain('第 2 页');

    const d = await nlExecute(token, '查看第2个', conv);
    expect(d.intent).toBe('paginate_view_detail');
  }, 40_000);
});
