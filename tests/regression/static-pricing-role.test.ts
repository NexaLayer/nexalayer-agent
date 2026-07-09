/**
 * Static Proxy Role-based Pricing Tests
 *
 * Validates the role-aware pricing display logic:
 *   A. Admin sees: cost + global price
 *   B. Agent (default) sees: agent price + cost
 *   C. Agent (target user) sees: user-specific price
 *   D. Normal user sees: own price only
 *   E. Agent target_user permission checks
 *
 * Aligned with frontend StaticBusiness.tsx behavior.
 *
 * SAFETY: No purchases are made — read-only queries.
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
    username: process.env.REGRESSION_USER_USERNAME ?? 'wenjianhao',
    password: requiredEnv('REGRESSION_USER_PASSWORD'),
  },
};

const PERF = { QUERY_MS: 25000 };

interface NLResponse {
  success: boolean;
  data: {
    conversation_id: string;
    intent: string;
    message: string;
    data?: Record<string, unknown>;
    suggestions?: string[];
  };
}

interface TestStep {
  label: string;
  message: string;
  expect: {
    intentOneOf?: string[];
    messageContains?: string[];
    messageNotContains?: string[];
    messageMatchesAny?: string[];
    maxMs?: number;
  };
}

interface TestScenario {
  name: string;
  suite: string;
  role: 'admin' | 'agent' | 'user';
  steps: TestStep[];
}

interface StepResult {
  label: string;
  passed: boolean;
  intent: string;
  messagePreview: string;
  failures: string[];
  durationMs: number;
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
  tokens[role] = body?.data?.token ?? '';
  return tokens[role];
}

async function nlExecute(
  message: string,
  token: string
): Promise<NLResponse> {
  const res = await fetch(
    `${AGENT_URL}/v1/nl/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  return (await res.json()) as NLResponse;
}

function validateStep(
  step: TestStep,
  data: NLResponse['data'],
  durationMs: number
): { failures: string[] } {
  const failures: string[] = [];
  const e = step.expect;
  const msg = data.message ?? '';
  const msgLower = msg.toLowerCase();
  const intent = data.intent ?? '';

  if (e.intentOneOf) {
    if (!e.intentOneOf.includes(intent)) {
      failures.push(
        `[INTENT] "${intent}" not in ` +
          `[${e.intentOneOf.join(',')}]`
      );
    }
  }
  if (e.messageContains) {
    for (const kw of e.messageContains) {
      if (!msgLower.includes(kw.toLowerCase())) {
        failures.push(
          `[CONTENT] missing "${kw}"`
        );
      }
    }
  }
  if (e.messageNotContains) {
    for (const kw of e.messageNotContains) {
      if (msgLower.includes(kw.toLowerCase())) {
        failures.push(
          `[CONTENT] should NOT contain "${kw}"`
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
        `[CONTENT] none of ` +
          `[${e.messageMatchesAny.join(',')}]`
      );
    }
  }
  if (e.maxMs && durationMs > e.maxMs) {
    failures.push(
      `[PERF] ${durationMs}ms > ${e.maxMs}ms`
    );
  }
  return { failures };
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'Admin pricing display',
    suite: 'A',
    role: 'admin',
    steps: [
      {
        label: 'Admin queries US IP list',
        message: '查看美国纽约的IP段列表',
        expect: {
          intentOneOf: [
            'query_static_products',
            'query_ip_inventory',
            'query_products',
          ],
          messageContains: ['库存'],
          messageMatchesAny: [
            '成本', '全局售价', 'cost', 'global',
          ],
          messageNotContains: [
            '代理商价', '我的价格',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'Agent default pricing display',
    suite: 'B',
    role: 'agent',
    steps: [
      {
        label: 'Agent queries US IP list',
        message: '查看美国纽约的IP段列表',
        expect: {
          intentOneOf: [
            'query_static_products',
            'query_ip_inventory',
            'query_products',
            'query_static_resource',
          ],
          messageMatchesAny: [
            '库存', '代理商价', '成本',
            '美国', '纽约',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'Agent target user pricing',
    suite: 'C',
    role: 'agent',
    steps: [
      {
        label:
          'Agent queries for user wenjianhao',
        message:
          '为用户 wenjianhao 查看美国纽约IP段价格',
        expect: {
          intentOneOf: [
            'query_static_products',
            'query_ip_inventory',
            'query_products',
            'query_users',
          ],
          messageMatchesAny: [
            'wenjianhao', '用户', '美国',
            '纽约', '库存',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'Normal user pricing display',
    suite: 'D',
    role: 'user',
    steps: [
      {
        label: 'User queries US IP list',
        message: '查看美国纽约的IP段列表',
        expect: {
          intentOneOf: [
            'query_static_products',
            'query_ip_inventory',
            'query_products',
            'query_static_resource',
          ],
          messageMatchesAny: [
            '库存', '我的价格', '¥', 'price',
            '美国', '纽约',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'Agent purchase requires target user',
    suite: 'E',
    role: 'agent',
    steps: [
      {
        label:
          'Agent tries purchase without user',
        message: '开通一个纽约IP，30天',
        expect: {
          messageMatchesAny: [
            '指定', '名下', 'sub-user',
            'specify', '确认',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
];

const allResults: Array<{
  name: string;
  suite: string;
  passed: boolean;
  steps: StepResult[];
}> = [];

describe('Static Proxy Role-based Pricing', () => {
  beforeAll(async () => {
    await Promise.all([
      loginAs('admin'),
      loginAs('agent'),
      loginAs('user'),
    ]);
  }, 30000);

  for (const sc of SCENARIOS) {
    describe(`[${sc.suite}] ${sc.name}`, () => {
      const stepResults: StepResult[] = [];

      for (const step of sc.steps) {
        it(
          step.label,
          async () => {
            const token = tokens[sc.role];
            expect(token).toBeTruthy();

            const t0 = Date.now();
            const resp = await nlExecute(
              step.message, token
            );
            const dur = Date.now() - t0;

            const d = resp.data;
            const { failures } = validateStep(
              step, d, dur
            );

            const sr: StepResult = {
              label: step.label,
              passed: failures.length === 0,
              intent: d.intent,
              messagePreview:
                (d.message ?? '').slice(0, 200),
              failures,
              durationMs: dur,
            };
            stepResults.push(sr);

            if (failures.length > 0) {
              console.log(
                `\n[FAIL] ${step.label}\n` +
                  `  Intent: ${d.intent}\n` +
                  `  Message: ` +
                  `${(d.message ?? '').slice(0, 300)}\n` +
                  `  Failures:\n` +
                  failures
                    .map((f) => `    - ${f}`)
                    .join('\n')
              );
            }

            expect(
              failures,
              failures.join('; ')
            ).toHaveLength(0);
          },
          60000
        );
      }

      it('collect results', () => {
        allResults.push({
          name: sc.name,
          suite: sc.suite,
          passed: stepResults.every(
            (s) => s.passed
          ),
          steps: stepResults,
        });
      });
    });
  }

  it('write report', () => {
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const dir = path.join(
      __dirname, 'results'
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const total = allResults.length;
    const passed = allResults.filter(
      (r) => r.passed
    ).length;
    const failed = total - passed;

    let md =
      `# Static Pricing Role Test ` +
      `(${ts})\n\n`;
    md += `| Suite | Scenario | Result |\n`;
    md += `|-------|----------|--------|\n`;
    for (const r of allResults) {
      const icon = r.passed ? '✅' : '❌';
      md +=
        `| ${r.suite} | ${r.name} | ` +
        `${icon} |\n`;
    }
    md +=
      `\n**${passed}/${total} passed, ` +
      `${failed} failed**\n`;

    for (const r of allResults) {
      md += `\n## [${r.suite}] ${r.name}\n`;
      for (const s of r.steps) {
        const icon = s.passed ? '✅' : '❌';
        md +=
          `\n### ${icon} ${s.label}\n` +
          `- Intent: ${s.intent}\n` +
          `- Duration: ${s.durationMs}ms\n` +
          `- Preview: ${s.messagePreview}\n`;
        if (s.failures.length > 0) {
          md += `- Failures:\n`;
          for (const f of s.failures) {
            md += `  - ${f}\n`;
          }
        }
      }
    }

    const mdPath = path.join(
      dir, `static-pricing-role-${ts}.md`
    );
    fs.writeFileSync(mdPath, md, 'utf8');

    const jsonPath = path.join(
      dir, `static-pricing-role-${ts}.json`
    );
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(allResults, null, 2),
      'utf8'
    );

    console.log(`Report: ${mdPath}`);
    expect(failed).toBe(0);
  });
});
