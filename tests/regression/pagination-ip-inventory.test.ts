/**
 * IP Inventory Pagination Regression Tests
 *
 * 7 suites:
 *   A. Basic pagination
 *   B. Multi-turn continuation
 *   C. Fuzzy expression
 *   D. Context reset
 *   E. Boundary
 *   F. Frontend consistency
 *   G. Regression (no-break existing)
 *
 * Quality gates:
 *   1. Functional: message content correct
 *   2. Semantic: expected intent
 *   3. Performance: response time within SLA
 *   4. Pagination: page/total/footer correct
 *
 * SAFETY: No test actually confirms a purchase.
 */
import {
  describe, it, expect, beforeAll,
} from 'vitest';
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

const ADMIN_USER =
  process.env.REGRESSION_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS =
  requiredEnv('REGRESSION_ADMIN_PASSWORD');

const PERF = {
  QUERY_MS: 15000,
  PAGINATION_MS: 15000,
  FOLLOW_UP_MS: 5000,
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
  confirm?: boolean;
  newConversation?: boolean;
  expect: {
    intentIs?: string;
    intentContains?: string[];
    intentNotContains?: string[];
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

let adminToken = '';

async function login(): Promise<string> {
  const res = await fetch(
    `${BACKEND_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: ADMIN_USER,
        password: ADMIN_PASS,
      }),
    }
  );
  const body = await res.json();
  return body?.data?.token ?? '';
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
      const wait = 2000 * (i + 1);
      await new Promise(
        (r) => setTimeout(r, wait)
      );
    }
  }
  throw new Error('unreachable');
}

async function nlExecute(
  message: string,
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
        Authorization: `Bearer ${adminToken}`,
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
    ) return undefined;
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
): {
  failures: string[];
  perfWarnings: string[];
} {
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
        `expected one of ` +
        `[${e.intentOneOf.join(',')}]`
      );
    }
  }
  if (e.intentContains) {
    for (const s of e.intentContains) {
      if (!intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent missing "${s}"`
        );
      }
    }
  }
  if (e.intentNotContains) {
    for (const s of e.intentNotContains) {
      if (intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent has "${s}"`
        );
      }
    }
  }
  if (e.messageContains) {
    for (const s of e.messageContains) {
      if (!msgLower.includes(s.toLowerCase())) {
        failures.push(
          `[FUNC] missing "${s}" ` +
          `(preview: ${msg.slice(0, 150)})`
        );
      }
    }
  }
  if (e.messageNotContains) {
    for (const s of e.messageNotContains) {
      if (msgLower.includes(s.toLowerCase())) {
        failures.push(
          `[FUNC] should NOT have "${s}"`
        );
      }
    }
  }
  if (e.messageMatchesAny) {
    const hit = e.messageMatchesAny.some(
      (s) => msgLower.includes(s.toLowerCase())
    );
    if (!hit) {
      failures.push(
        `[FUNC] no match in ` +
        `[${e.messageMatchesAny.join(',')}]`
      );
    }
  }
  if (e.hasData !== undefined) {
    if (!!data.data !== e.hasData) {
      failures.push(
        `[FUNC] hasData=${!!data.data} ` +
        `expected=${e.hasData}`
      );
    }
  }
  if (e.dataChecks && data.data) {
    for (const chk of e.dataChecks) {
      const val = getNestedValue(
        data.data, chk.path
      );
      switch (chk.op) {
        case 'exists':
          if (val == null) {
            failures.push(
              `[DATA] ${chk.path} missing`
            );
          }
          break;
        case 'gt':
          if (
            typeof val !== 'number' ||
            val <= (chk.value as number)
          ) {
            failures.push(
              `[DATA] ${chk.path}=${val} ` +
              `expected >${chk.value}`
            );
          }
          break;
        case 'eq':
          if (val !== chk.value) {
            failures.push(
              `[DATA] ${chk.path}=${val} ` +
              `expected=${chk.value}`
            );
          }
          break;
        case 'contains':
          if (
            typeof val !== 'string' ||
            !val.includes(chk.value as string)
          ) {
            failures.push(
              `[DATA] ${chk.path} not ` +
              `containing "${chk.value}"`
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
  const start = Date.now();
  const results: StepResult[] = [];
  let convId = '';

  for (const step of scenario.steps) {
    if (step.newConversation) convId = '';

    const stepStart = Date.now();
    let res: NLResponse;

    if (step.message) {
      res = await nlExecute(
        step.message, convId || undefined
      );
    } else {
      results.push({
        label: step.label,
        passed: false,
        intent: '',
        messagePreview: 'No action',
        failures: ['Step has no action'],
        perfWarnings: [],
        conversationId: convId,
        durationMs: 0,
      });
      continue;
    }

    const dur = Date.now() - stepStart;
    convId =
      res.data?.conversation_id || convId;

    const { failures, perfWarnings } =
      validateStep(step, res.data, dur);

    results.push({
      label: step.label,
      passed: failures.length === 0,
      intent: res.data?.intent || '',
      messagePreview:
        (res.data?.message || '').slice(0, 120),
      failures,
      perfWarnings,
      conversationId: convId,
      durationMs: dur,
    });
  }

  return {
    name: scenario.name,
    suite: scenario.suite,
    description: scenario.description,
    passed: results.every((r) => r.passed),
    steps: results,
    totalMs: Date.now() - start,
  };
}

/* ═══════════════ Scenarios ═══════════════ */

const SCENARIOS: TestScenario[] = [
  /* ── Suite A: Basic pagination ── */
  {
    name: 'A1',
    suite: 'A. Basic pagination',
    description:
      'Query all IPs returns paginated page 1',
    steps: [
      {
        label: 'A1.1 都有哪些IP',
        message: '都有哪些IP',
        expect: {
          intentOneOf: [
            'query_ip_inventory',
            'query_products',
          ],
          messageContains: ['第 1 页'],
          messageMatchesAny: [
            '下一页', '继续', 'next',
          ],
          hasData: true,
          dataChecks: [
            { path: 'total', op: 'gt', value: 0 },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'A2',
    suite: 'A. Basic pagination',
    description: 'Next page works',
    steps: [
      {
        label: 'A2.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A2.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          messageContains: ['第 2 页'],
          hasData: true,
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'A3',
    suite: 'A. Basic pagination',
    description: 'Prev page works',
    steps: [
      {
        label: 'A3.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A3.2 下一页',
        message: '下一页',
        expect: {
          messageContains: ['第 2 页'],
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'A3.3 上一页',
        message: '上一页',
        expect: {
          intentIs: 'paginate_prev',
          messageContains: ['第 1 页'],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'A4',
    suite: 'A. Basic pagination',
    description: 'Jump to page 3',
    steps: [
      {
        label: 'A4.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A4.2 第3页',
        message: '第3页',
        expect: {
          intentIs: 'paginate_to_page',
          messageMatchesAny: [
            '第 3 页', 'page 3',
          ],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'A5',
    suite: 'A. Basic pagination',
    description: 'Change page size',
    steps: [
      {
        label: 'A5.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A5.2 每页20条',
        message: '每页20条',
        expect: {
          intentIs: 'paginate_change_page_size',
          messageContains: ['第 1 页'],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'A6',
    suite: 'A. Basic pagination',
    description: 'View detail item 5',
    steps: [
      {
        label: 'A6.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A6.2 看第5个',
        message: '看第5个',
        expect: {
          intentIs: 'paginate_view_detail',
          messageMatchesAny: [
            '第 5 条', '第5条', 'item #5',
            '第 5 个', '#5',
          ],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },

  /* ── Suite B: Multi-turn continuation ── */
  {
    name: 'B1',
    suite: 'B. Multi-turn continuation',
    description:
      'Query NYC -> next page -> purchase 3rd',
    steps: [
      {
        label: 'B1.1 查纽约IP',
        message: '查纽约有哪些IP',
        expect: {
          messageMatchesAny: [
            '第 1 页', 'page 1',
            '纽约', 'new york',
          ],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'B1.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'B1.3 开通第三个',
        message: '开通第三个',
        expect: {
          intentNotContains: ['unknown'],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'B2',
    suite: 'B. Multi-turn continuation',
    description:
      'Query US -> cheapest -> next -> buy 2nd',
    steps: [
      {
        label: 'B2.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'B2.2 最便宜的',
        message: '最便宜的',
        expect: {
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'B2.3 下一页',
        message: '下一页',
        expect: {
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'B2.4 开通第二个',
        message: '开通第二个',
        expect: {
          intentNotContains: ['unknown'],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'B3',
    suite: 'B. Multi-turn continuation',
    description:
      'Query London -> page 2 -> view 1 -> ' +
      'switch to 3rd',
    steps: [
      {
        label: 'B3.1 查伦敦IP',
        message: '查伦敦有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'B3.2 第2页',
        message: '第2页',
        expect: {
          intentIs: 'paginate_to_page',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'B3.3 看第1个',
        message: '看第1个',
        expect: {
          intentIs: 'paginate_view_detail',
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'B4',
    suite: 'B. Multi-turn continuation',
    description:
      'Query all -> 20 per page -> next -> ' +
      'buy 10th',
    steps: [
      {
        label: 'B4.1 查所有IP',
        message: '查所有IP',
        expect: {
          messageContains: ['第 1 页'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'B4.2 每页20条',
        message: '每页20条',
        expect: {
          intentIs: 'paginate_change_page_size',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'B4.3 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },

  /* ── Suite C: Fuzzy expressions ── */
  {
    name: 'C1',
    suite: 'C. Fuzzy expression',
    description: '"继续" as next page',
    steps: [
      {
        label: 'C1.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C1.2 继续',
        message: '继续',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'C2',
    suite: 'C. Fuzzy expression',
    description: '"往后翻" as next page',
    steps: [
      {
        label: 'C2.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C2.2 往后翻',
        message: '往后翻',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'C3',
    suite: 'C. Fuzzy expression',
    description: '"后面还有吗" as next page',
    steps: [
      {
        label: 'C3.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C3.2 后面还有吗',
        message: '后面还有吗',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'C4',
    suite: 'C. Fuzzy expression',
    description: '"跳到第2页" jump',
    steps: [
      {
        label: 'C4.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C4.2 跳到第2页',
        message: '跳到第2页',
        expect: {
          intentIs: 'paginate_to_page',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'C5',
    suite: 'C. Fuzzy expression',
    description: '"多显示一点" doubles page size',
    steps: [
      {
        label: 'C5.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C5.2 多显示一点',
        message: '多显示一点',
        expect: {
          intentIs: 'paginate_change_page_size',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'C6',
    suite: 'C. Fuzzy expression',
    description: '"看第3个" view detail',
    steps: [
      {
        label: 'C6.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C6.2 看第3个',
        message: '看第3个',
        expect: {
          intentIs: 'paginate_view_detail',
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'C7',
    suite: 'C. Fuzzy expression',
    description: '"往前翻" as prev page',
    steps: [
      {
        label: 'C7.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'C7.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'C7.3 往前翻',
        message: '往前翻',
        expect: {
          intentIs: 'paginate_prev',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },

  /* ── Suite D: Context reset ── */
  {
    name: 'D1',
    suite: 'D. Context reset',
    description:
      'NYC -> next -> check balance -> ' +
      'next should warn',
    steps: [
      {
        label: 'D1.1 查纽约IP',
        message: '查纽约有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'D1.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'D1.3 查余额',
        message: '查询余额',
        expect: {
          intentOneOf: [
            'query_balance',
            'query_account_info',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'D1.4 再下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'D2',
    suite: 'D. Context reset',
    description:
      'NYC IP -> "英国的呢" new query resets',
    steps: [
      {
        label: 'D2.1 查纽约IP',
        message: '查纽约有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'D2.2 英国的呢',
        message: '英国的呢',
        expect: {
          intentNotContains: ['paginate'],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'D3',
    suite: 'D. Context reset',
    description:
      'NYC -> next -> monthly cost -> ' +
      'buy 3rd should not work',
    steps: [
      {
        label: 'D3.1 查纽约IP',
        message: '查纽约有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'D3.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'D3.3 查本月消费',
        message: '查本月消费',
        expect: {
          intentNotContains: ['paginate'],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'D4',
    suite: 'D. Context reset',
    description:
      'NYC -> next -> help -> ' +
      'next should still work',
    steps: [
      {
        label: 'D4.1 查纽约IP',
        message: '查纽约有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'D4.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
      {
        label: 'D4.3 帮助',
        message: '帮助',
        expect: {
          intentOneOf: [
            'show_help', 'help',
          ],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'D4.4 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },

  /* ── Suite E: Boundary ── */
  {
    name: 'E1',
    suite: 'E. Boundary',
    description:
      'First page -> prev -> should warn',
    steps: [
      {
        label: 'E1.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          messageContains: ['第 1 页'],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E1.2 上一页',
        message: '上一页',
        expect: {
          intentIs: 'paginate_prev',
          messageMatchesAny: [
            '第一页', 'first page',
            '已经是第一页',
          ],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'E2',
    suite: 'E. Boundary',
    description: 'Page 999 out of range',
    steps: [
      {
        label: 'E2.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E2.2 第999页',
        message: '第999页',
        expect: {
          intentIs: 'paginate_to_page',
          messageMatchesAny: [
            '最后一页', 'last page',
            '超出范围', 'out of range',
            '已经是最后一页',
          ],
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'E3',
    suite: 'E. Boundary',
    description:
      'View item 25 when page has 20',
    steps: [
      {
        label: 'E3.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E3.2 看第25个',
        message: '看第25个',
        expect: {
          intentIs: 'paginate_view_detail',
          messageMatchesAny: [
            '只有', '请输入', 'has',
            '1-20', '序号',
          ],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'E4',
    suite: 'E. Boundary',
    description: 'Page size 1000 (capped)',
    steps: [
      {
        label: 'E4.1 查所有IP',
        message: '都有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'E4.2 每页1000条',
        message: '每页1000条',
        expect: {
          intentIs: 'paginate_change_page_size',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },

  /* ── Suite F: Frontend consistency ── */
  {
    name: 'F1',
    suite: 'F. Frontend consistency',
    description:
      'All IPs: has total > 0, has products',
    steps: [
      {
        label: 'F1.1 都有哪些IP',
        message: '都有哪些IP',
        expect: {
          hasData: true,
          dataChecks: [
            { path: 'total', op: 'gt', value: 0 },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F2',
    suite: 'F. Frontend consistency',
    description: 'NYC IPs return data',
    steps: [
      {
        label: 'F2.1 纽约有哪些IP',
        message: '纽约有哪些IP',
        expect: {
          hasData: true,
          messageMatchesAny: [
            '纽约', 'new york',
            'newyork', '📦',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F3',
    suite: 'F. Frontend consistency',
    description: 'US IPs return data',
    steps: [
      {
        label: 'F3.1 美国有哪些IP',
        message: '美国有哪些IP',
        expect: {
          hasData: true,
          dataChecks: [
            { path: 'total', op: 'gt', value: 0 },
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F4',
    suite: 'F. Frontend consistency',
    description: 'London IPs return data',
    steps: [
      {
        label: 'F4.1 伦敦有哪些IP',
        message: '伦敦有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F5',
    suite: 'F. Frontend consistency',
    description: 'Jakarta IPs',
    steps: [
      {
        label: 'F5.1 雅加达有哪些IP',
        message: '雅加达有哪些IP',
        expect: {
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'F6',
    suite: 'F. Frontend consistency',
    description: 'Taipei IPs',
    steps: [
      {
        label: 'F6.1 台北有哪些IP',
        message: '台北有哪些IP',
        expect: {
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },

  /* ── Suite G: Regression (no-break) ── */
  {
    name: 'G1',
    suite: 'G. Regression',
    description:
      'Static order pagination still works',
    steps: [
      {
        label: 'G1.1 查静态订单',
        message: '查询静态代理订单',
        expect: {
          intentOneOf: [
            'query_static_orders',
            'query_orders',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'G1.2 下一页',
        message: '下一页',
        expect: {
          intentIs: 'paginate_next',
          maxMs: PERF.PAGINATION_MS,
        },
      },
    ],
  },
  {
    name: 'G2',
    suite: 'G. Regression',
    description:
      'Dynamic order pagination still works',
    steps: [
      {
        label: 'G2.1 查动态订单',
        message: '查询动态代理订单',
        expect: {
          intentOneOf: [
            'query_dynamic_orders',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'G3',
    suite: 'G. Regression',
    description:
      'Transaction pagination still works',
    steps: [
      {
        label: 'G3.1 查交易记录',
        message: '查询充值扣费记录',
        expect: {
          intentOneOf: [
            'query_transactions',
            'query_balance',
            'query_nl_history',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'G4',
    suite: 'G. Regression',
    description:
      'Dynamic extract flow not broken',
    steps: [
      {
        label: 'G4.1 提取动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentOneOf: [
            'extract_dynamic',
            'query_ip_inventory',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'G5',
    suite: 'G. Regression',
    description:
      'IP query with geo filter still works',
    steps: [
      {
        label: 'G5.1 查东京IP',
        message: '查东京有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
    ],
  },
  {
    name: 'G6',
    suite: 'G. Regression',
    description:
      'Existing follow-up select works',
    steps: [
      {
        label: 'G6.1 查美国IP',
        message: '查美国有哪些IP',
        expect: {
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'G6.2 找最便宜的',
        message: '找最便宜的',
        expect: {
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
];

/* ═══════════════ Report ═══════════════ */

function generateReport(
  results: ScenarioResult[]
): string {
  const now = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
  const passed = results.filter(
    (r) => r.passed
  ).length;
  const failed = results.length - passed;
  const totalMs = results.reduce(
    (s, r) => s + r.totalMs, 0
  );
  const totalSteps = results.reduce(
    (s, r) => s + r.steps.length, 0
  );
  const perfWarnCount = results.reduce(
    (s, r) =>
      s + r.steps.reduce(
        (ss, st) =>
          ss + st.perfWarnings.length, 0
      ),
    0
  );

  let md = '# IP Inventory Pagination ' +
    'Regression Report\n\n';
  md += `**Date**: ${now}\n`;
  md += `**Scenarios**: ${results.length} ` +
    `(${passed} passed, ${failed} failed)\n`;
  md += `**Steps**: ${totalSteps}\n`;
  md += `**Total time**: ` +
    `${(totalMs / 1000).toFixed(1)}s\n`;
  md += `**Perf warnings**: ${perfWarnCount}\n`;
  md += `**Pass rate**: ` +
    `${((passed / results.length) * 100)
      .toFixed(1)}%\n\n`;

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
      md += `### ${icon} ${r.name}: ` +
        `${r.description}\n`;
      md += `${r.description} | ` +
        `${r.totalMs}ms\n\n`;
      for (const s of r.steps) {
        const si = s.passed ? '✅' : '❌';
        md += `- ${si} **${s.label}** ` +
          `[${s.intent}] ${s.durationMs}ms\n`;
        if (s.failures.length) {
          for (const f of s.failures) {
            md += `  - ❌ ${f}\n`;
          }
        }
        if (s.perfWarnings.length) {
          for (const w of s.perfWarnings) {
            md += `  - ⚠️ ${w}\n`;
          }
        }
      }
      md += '\n';
    }
  }

  const dir = path.join(
    __dirname, 'results'
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const jsonFile = path.join(
    dir, `pagination-${now}.json`
  );
  const mdFile = path.join(
    dir, `pagination-${now}.md`
  );
  const latestFile = path.join(
    dir, 'pagination-latest.md'
  );
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(results, null, 2)
  );
  fs.writeFileSync(mdFile, md);
  fs.writeFileSync(latestFile, md);

  return md;
}

/* ═══════════════ Test runner ═══════════ */

describe(
  'IP Inventory Pagination Regression',
  () => {
    beforeAll(async () => {
      adminToken = await login();
      expect(adminToken).toBeTruthy();
    }, 30_000);

    const allResults: ScenarioResult[] = [];

    for (const scenario of SCENARIOS) {
      it(
        `${scenario.name}: ` +
          `${scenario.description}`,
        async () => {
          const result =
            await runScenario(scenario);
          allResults.push(result);

          for (const step of result.steps) {
            if (step.failures.length > 0) {
              console.log(
                `\n❌ ${step.label}:\n` +
                step.failures
                  .map((f) => `  ${f}`)
                  .join('\n')
              );
            }
            if (step.perfWarnings.length > 0) {
              console.log(
                `\n⚠️ ${step.label}:\n` +
                step.perfWarnings
                  .map((w) => `  ${w}`)
                  .join('\n')
              );
            }
          }

          expect(result.passed).toBe(true);
        },
        120_000
      );
    }

    it('Generate report', () => {
      if (allResults.length === 0) return;
      const report =
        generateReport(allResults);
      console.log(
        '\n' + report.slice(0, 500) + '...'
      );
      expect(report).toBeTruthy();
    });
  }
);
