/**
 * Static Order Display — Role-based & Pagination Tests
 *
 * Suites:
 *   A. Default page size = 20
 *   B. Admin order display
 *   C. Agent order display
 *   D. User order display
 *   E. Multi-turn pagination across roles
 *
 * 3-layer quality gates:
 *   1. Functional: message content correct
 *   2. Semantic:  expected intent
 *   3. Performance: within SLA
 *
 * SAFETY: No purchases are made.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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
  admin: {
    username: process.env.REGRESSION_ADMIN_USERNAME ?? 'admin',
    password: requiredEnv('REGRESSION_ADMIN_PASSWORD'),
  },
  agent: {
    username: process.env.REGRESSION_AGENT_USERNAME ?? 'yijivip',
    password: requiredEnv('REGRESSION_AGENT_PASSWORD'),
  },
  user: {
    username:
      process.env.REGRESSION_ORDER_USER_USERNAME ??
      process.env.REGRESSION_USER_USERNAME ??
      'dongtaiceshi4',
    password:
      process.env.REGRESSION_ORDER_USER_PASSWORD ??
      requiredEnv('REGRESSION_USER_PASSWORD'),
  },
};

const PERF = {
  QUERY_MS: 20000,
  PAGINATION_MS: 15000,
  FOLLOW_UP_MS: 10000,
};

interface NLResponse {
  success: boolean;
  data: {
    conversation_id: string;
    intent: string;
    message: string;
    data?: Record<string, unknown>;
    requires_confirmation?: boolean;
    confirmation_id?: string;
    suggestions?: string[];
  };
}

interface TestStep {
  label: string;
  message?: string;
  newConversation?: boolean;
  expect: {
    intentIs?: string;
    intentOneOf?: string[];
    messageContains?: string[];
    messageNotContains?: string[];
    messageMatchesAny?: string[];
    hasData?: boolean;
    maxMs?: number;
    dataChecks?: Array<{
      path: string;
      op: 'exists' | 'gt' | 'eq' | 'contains';
      value?: unknown;
    }>;
  };
}

interface TestScenario {
  name: string;
  suite: string;
  description: string;
  role: 'admin' | 'agent' | 'user';
  steps: TestStep[];
}

interface StepResult {
  label: string;
  passed: boolean;
  intent: string;
  messagePreview: string;
  failures: string[];
  perfWarnings: string[];
  conversationId: string;
  durationMs: number;
}

interface ScenarioResult {
  name: string;
  suite: string;
  description: string;
  passed: boolean;
  steps: StepResult[];
  totalMs: number;
}

const tokens: Record<string, string> = {};

async function loginAs(
  role: 'admin' | 'agent' | 'user'
): Promise<string> {
  if (tokens[role]) return tokens[role];
  const acct = ACCOUNTS[role];
  const res = await fetch(
    `${BACKEND_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: acct.username,
        password: acct.password,
      }),
    }
  );
  const body = await res.json();
  const tk = body?.data?.token ?? '';
  tokens[role] = tk;
  return tk;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(
        (r) => setTimeout(r, 2000 * (i + 1))
      );
    }
  }
  throw new Error('unreachable');
}

async function nlExecute(
  message: string,
  token: string,
  conversationId?: string
): Promise<NLResponse> {
  const body: Record<string, unknown> =
    { message };
  if (conversationId) {
    body.conversation_id = conversationId;
  }
  const res = await fetchWithRetry(
    `${AGENT_URL}/v1/nl/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );
  return (await res.json()) as NLResponse;
}

function getNestedValue(
  obj: Record<string, unknown>,
  pathStr: string
): unknown {
  const keys = pathStr.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (
      current == null ||
      typeof current !== 'object'
    )
      return undefined;
    current = (
      current as Record<string, unknown>
    )[key];
  }
  return current;
}

function validateStep(
  step: TestStep,
  data: NLResponse['data'],
  durationMs: number
): { failures: string[]; perfWarnings: string[] } {
  const failures: string[] = [];
  const perfWarnings: string[] = [];
  const e = step.expect;
  const msg = data.message ?? '';
  const msgLower = msg.toLowerCase();
  const intent = data.intent ?? '';

  if (e.intentIs) {
    if (intent !== e.intentIs) {
      failures.push(
        `[SEMANTIC] intent="${intent}" ` +
          `expected="${e.intentIs}"`
      );
    }
  }
  if (e.intentOneOf) {
    if (!e.intentOneOf.includes(intent)) {
      failures.push(
        `[SEMANTIC] intent="${intent}" ` +
          `not in [${e.intentOneOf.join(',')}]`
      );
    }
  }
  if (e.messageContains) {
    for (const kw of e.messageContains) {
      if (!msgLower.includes(kw.toLowerCase())) {
        failures.push(
          `[FUNC] missing "${kw}" in message`
        );
      }
    }
  }
  if (e.messageNotContains) {
    for (const kw of e.messageNotContains) {
      if (msgLower.includes(kw.toLowerCase())) {
        failures.push(
          `[FUNC] should NOT contain "${kw}"`
        );
      }
    }
  }
  if (e.messageMatchesAny) {
    const found = e.messageMatchesAny.some(
      (kw) => msgLower.includes(kw.toLowerCase())
    );
    if (!found) {
      failures.push(
        `[FUNC] none of ` +
          `[${e.messageMatchesAny.join(',')}] ` +
          `found in message`
      );
    }
  }
  if (e.hasData && !data.data) {
    failures.push(`[FUNC] expected data payload`);
  }
  if (e.dataChecks && data.data) {
    for (const dc of e.dataChecks) {
      const val = getNestedValue(
        data.data, dc.path
      );
      switch (dc.op) {
        case 'exists':
          if (val === undefined) {
            failures.push(
              `[DATA] ${dc.path} missing`
            );
          }
          break;
        case 'gt':
          if (
            typeof val !== 'number' ||
            val <= (dc.value as number)
          ) {
            failures.push(
              `[DATA] ${dc.path}=${val} ` +
                `not > ${dc.value}`
            );
          }
          break;
        case 'eq':
          if (val !== dc.value) {
            failures.push(
              `[DATA] ${dc.path}=${val} ` +
                `!= ${dc.value}`
            );
          }
          break;
        case 'contains':
          if (
            typeof val !== 'string' ||
            !val.includes(dc.value as string)
          ) {
            failures.push(
              `[DATA] ${dc.path} ` +
                `not contains "${dc.value}"`
            );
          }
          break;
      }
    }
  }
  if (e.maxMs && durationMs > e.maxMs) {
    perfWarnings.push(
      `[PERF] ${durationMs}ms > ${e.maxMs}ms`
    );
  }
  return { failures, perfWarnings };
}

async function runScenario(
  scenario: TestScenario
): Promise<ScenarioResult> {
  const token = await loginAs(scenario.role);
  if (!token) {
    return {
      name: scenario.name,
      suite: scenario.suite,
      description: scenario.description,
      passed: false,
      steps: [{
        label: 'login',
        passed: false,
        intent: '',
        messagePreview: '',
        failures: [
          `Cannot login as ${scenario.role}`
        ],
        perfWarnings: [],
        conversationId: '',
        durationMs: 0,
      }],
      totalMs: 0,
    };
  }

  let convId = '';
  const stepResults: StepResult[] = [];
  const start = Date.now();

  for (const step of scenario.steps) {
    if (step.newConversation) convId = '';
    const msg = step.message || '';

    const t0 = Date.now();
    const resp = await nlExecute(
      msg, token, convId || undefined
    );
    const durationMs = Date.now() - t0;

    const d = resp.data;
    convId = d?.conversation_id ?? convId;

    const { failures, perfWarnings } =
      validateStep(step, d, durationMs);

    stepResults.push({
      label: step.label,
      passed: failures.length === 0,
      intent: d?.intent ?? '',
      messagePreview:
        (d?.message ?? '').slice(0, 120),
      failures,
      perfWarnings,
      conversationId: convId,
      durationMs,
    });
  }

  return {
    name: scenario.name,
    suite: scenario.suite,
    description: scenario.description,
    passed: stepResults.every((s) => s.passed),
    steps: stepResults,
    totalMs: Date.now() - start,
  };
}

const SCENARIOS: TestScenario[] = [
  /* ── Suite A: Default page size = 20 ── */
  {
    name: 'A1',
    suite: 'A. Default page size',
    description:
      'Admin: static orders default 20 items',
    role: 'admin',
    steps: [
      {
        label: 'A1.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          dataChecks: [
            {
              path: 'total',
              op: 'gt',
              value: 0,
            },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'A2',
    suite: 'A. Default page size',
    description:
      'Admin: IP inventory default 20 items',
    role: 'admin',
    steps: [
      {
        label: 'A2.1 都有哪些IP',
        message: '都有哪些IP',
        expect: {
          intentOneOf: [
            'query_ip_inventory',
            'query_products',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'A3',
    suite: 'A. Default page size',
    description:
      'Admin: transaction list default 20 items',
    role: 'admin',
    steps: [
      {
        label: 'A3.1 查交易记录',
        message: '查看交易记录',
        expect: {
          intentOneOf: [
            'query_transactions',
            'query_nl_history',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'A4',
    suite: 'A. Default page size',
    description:
      'Admin: dynamic orders default 20 items',
    role: 'admin',
    steps: [
      {
        label: 'A4.1 查动态订单',
        message: '查看动态订单',
        expect: {
          intentOneOf: [
            'query_dynamic_orders',
            'query_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'A5',
    suite: 'A. Default page size',
    description:
      'Admin: NL history default 20 items',
    role: 'admin',
    steps: [
      {
        label: 'A5.1 查历史记录',
        message: '查看对话历史',
        expect: {
          intentOneOf: [
            'query_nl_history',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },

  /* ── Suite B: Admin — new format ── */
  {
    name: 'B1',
    suite: 'B. Admin display',
    description:
      'Admin: has field labels 订单号/实例/用户/代理商',
    role: 'admin',
    steps: [
      {
        label: 'B1.1 Admin查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: [
            '订单号', '实例',
            '用户：', '代理商：',
          ],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'B2',
    suite: 'B. Admin display',
    description:
      'Admin: has price labels 用户价格/代理商价格/成本',
    role: 'admin',
    steps: [
      {
        label: 'B2.1 Admin price labels',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: [
            '用户价格：', '代理商价格：', '成本：',
          ],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'B3',
    suite: 'B. Admin display',
    description:
      'Admin: has dates 到期/创建/更新',
    role: 'admin',
    steps: [
      {
        label: 'B3.1 Admin dates',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: [
            '到期:', '创建:', '更新:',
          ],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'B4',
    suite: 'B. Admin display',
    description:
      'Admin: no "30天" biz type shown',
    role: 'admin',
    steps: [
      {
        label: 'B4.1 Admin no biz type',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageNotContains: ['30天'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'B5',
    suite: 'B. Admin display',
    description:
      'Admin: multi-instance order is split ' +
      'into separate records',
    role: 'admin',
    steps: [
      {
        label: 'B5.1 Admin查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          hasData: true,
          dataChecks: [
            {
              path: 'instanceCount',
              op: 'gt',
              value: 0,
            },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },

  /* ── Suite C: Agent display ── */
  {
    name: 'C1',
    suite: 'C. Agent display',
    description:
      'Agent: has 用户价格/代理商价格,' +
      ' no 成本',
    role: 'agent',
    steps: [
      {
        label: 'C1.1 Agent查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: [
            '用户价格：', '代理商价格：',
          ],
          messageNotContains: ['成本：'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'C2',
    suite: 'C. Agent display',
    description:
      'Agent: has 用户： but no 代理商：',
    role: 'agent',
    steps: [
      {
        label: 'C2.1 Agent user label',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['用户：'],
          messageNotContains: ['代理商：'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'C3',
    suite: 'C. Agent display',
    description:
      'Agent: has 到期/创建/更新, no biz type',
    role: 'agent',
    steps: [
      {
        label: 'C3.1 Agent dates',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: [
            '到期:', '创建:', '更新:',
          ],
          messageNotContains: ['30天'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },

  /* ── Suite D: User display ── */
  {
    name: 'D1',
    suite: 'D. User display',
    description:
      'User: has 用户价格, no 代理商价格/成本',
    role: 'user',
    steps: [
      {
        label: 'D1.1 User查静态订单',
        message: '查看我的静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageMatchesAny: [
            '用户价格', '暂无', '订单',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },

  /* ── Suite E: Pagination multi-turn ── */
  {
    name: 'E1',
    suite: 'E. Pagination multi-turn',
    description:
      'Admin: query → next page → prev page',
    role: 'admin',
    steps: [
      {
        label: 'E1.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E1.2 下一页',
        message: '下一页',
        expect: {
          intentOneOf: [
            'paginate_next',
            'query_static_orders',
          ],
          messageContains: ['第 2 页'],
          hasData: true,
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'E1.3 上一页',
        message: '上一页',
        expect: {
          intentOneOf: [
            'paginate_prev',
            'query_static_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'E2',
    suite: 'E. Pagination multi-turn',
    description:
      'Agent: query → next page',
    role: 'agent',
    steps: [
      {
        label: 'E2.1 Agent查静态订单',
        message: '查看我的静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E2.2 Agent下一页',
        message: '下一页',
        expect: {
          intentOneOf: [
            'paginate_next',
            'query_static_orders',
          ],
          messageMatchesAny: ['第 2 页', '已经是'],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'E3',
    suite: 'E. Pagination multi-turn',
    description:
      'Admin: query → jump to page 3',
    role: 'admin',
    steps: [
      {
        label: 'E3.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E3.2 跳转到第3页',
        message: '第3页',
        expect: {
          intentOneOf: [
            'paginate_to_page',
            'query_static_orders',
          ],
          messageMatchesAny: [
            '第 3 页', '超出', '已经是',
          ],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'E4',
    suite: 'E. Pagination multi-turn',
    description:
      'Admin: query → change page size',
    role: 'admin',
    steps: [
      {
        label: 'E4.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E4.2 每页5条',
        message: '每页5条',
        expect: {
          intentOneOf: [
            'paginate_change_page_size',
            'query_static_orders',
          ],
          hasData: true,
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },

  /* ── Suite F: Instance-level split ── */
  {
    name: 'F1',
    suite: 'F. Instance split',
    description:
      'Multi-instance order appears as ' +
      'multiple numbered records',
    role: 'admin',
    steps: [
      {
        label: 'F1.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['订单号：'],
          hasData: true,
          dataChecks: [
            {
              path: 'instanceCount',
              op: 'gt',
              value: 0,
            },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F2',
    suite: 'F. Instance split',
    description:
      'Each record has exactly one 实例 line',
    role: 'admin',
    steps: [
      {
        label: 'F2.1 查静态订单',
        message: '查看静态订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          messageContains: ['实例：'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
];

function generateReport(
  results: ScenarioResult[]
): string {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const ts = new Date().toISOString();

  let md = `# Static Order Display Tests\n`;
  md += `_${ts}_\n\n`;
  md += `| Metric | Value |\n`;
  md += `| --- | --- |\n`;
  md += `| Total | ${results.length} |\n`;
  md += `| Passed | ${passed.length} |\n`;
  md += `| Failed | ${failed.length} |\n\n`;

  const suites = [
    ...new Set(results.map((r) => r.suite)),
  ];
  for (const suite of suites) {
    md += `## ${suite}\n\n`;
    const group = results.filter(
      (r) => r.suite === suite
    );
    for (const r of group) {
      const icon = r.passed ? '✅' : '❌';
      md +=
        `### ${icon} ${r.name}: ` +
        `${r.description} | ${r.totalMs}ms\n\n`;
      for (const s of r.steps) {
        const si = s.passed ? '✅' : '❌';
        md += `- ${si} **${s.label}** `;
        md += `[${s.intent}] ${s.durationMs}ms`;
        if (s.failures.length) {
          md += `\n  - `;
          md += s.failures.join('\n  - ');
        }
        if (s.perfWarnings.length) {
          md += `\n  - ⚠️ `;
          md += s.perfWarnings.join('\n  - ⚠️ ');
        }
        md += '\n';
      }
      md += '\n';
    }
  }
  return md;
}

describe('Static Order Display Tests', () => {
  beforeAll(async () => {
    await loginAs('admin');
  }, 30_000);

  it(
    'runs all scenarios',
    async () => {
      const results: ScenarioResult[] = [];
      for (const sc of SCENARIOS) {
        const r = await runScenario(sc);
        results.push(r);
      }

      const reportMd = generateReport(results);
      const dir = path.join(
        __dirname, 'results'
      );
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      fs.writeFileSync(
        path.join(
          dir,
          `static-order-${ts}.md`
        ),
        reportMd
      );
      fs.writeFileSync(
        path.join(
          dir,
          `static-order-${ts}.json`
        ),
        JSON.stringify(results, null, 2)
      );

      const failedScenarios = results.filter(
        (r) => !r.passed
      );
      if (failedScenarios.length > 0) {
        console.log('\n=== FAILURES ===');
        for (const f of failedScenarios) {
          console.log(`\n❌ ${f.name}: ${f.description}`);
          for (const s of f.steps) {
            if (!s.passed) {
              console.log(
                `  Step: ${s.label}`
              );
              console.log(
                `  Intent: ${s.intent}`
              );
              console.log(
                `  Msg: ${s.messagePreview}`
              );
              for (const fl of s.failures) {
                console.log(`  ${fl}`);
              }
            }
          }
        }
      }

      console.log(
        `\n${results.length - failedScenarios.length}` +
          `/${results.length} passed`
      );
      expect(failedScenarios.length).toBe(0);
    },
    600_000
  );
});
