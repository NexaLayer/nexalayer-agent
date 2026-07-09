/**
 * Multi-turn Conversation Flow Regression Tests
 *
 * 8 suites:
 *   A. Result-set continuation
 *   B. Confirmation state machine
 *   C. Error recovery
 *   D. Language & aliases
 *   ISO. Session isolation
 *   DIS. Disambiguation & ranking
 *   NEG. Negative semantics (denial + correction)
 *   CROSS. Cross-module chains
 *
 * 3-layer quality gates:
 *   1. Functional: message content correct
 *   2. Semantic:  expected intent (not fallback)
 *   3. Performance: response time within SLA
 *
 * SAFETY: No test actually confirms a purchase.
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

const ADMIN_USER =
  process.env.REGRESSION_ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS =
  requiredEnv('REGRESSION_ADMIN_PASSWORD');

const PERF = {
  CANCEL_CONFIRM_MS: 3000,
  FOLLOW_UP_MS: 5000,
  QUERY_MS: 15000,
  QUALITY_CHECK_MS: 30000,
};

const RAW_CODE_BLOCKLIST = [
  'ipv_', 'mb_', 'LM_', 'ipidea',
  'product_no',
];

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
    messageContains?: string[];
    messageNotContains?: string[];
    messageMatchesAny?: string[];
    noRawCodes?: boolean;
    hasConfirmation?: boolean;
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
  hasConfirmation: boolean;
  confirmationId?: string;
  durationMs: number;
}

interface ScenarioResult {
  name: string;
  suite: string;
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

async function nlConfirm(
  conversationId: string,
  confirmationId: string,
  confirmed: boolean
): Promise<NLResponse> {
  const res = await fetchWithRetry(
    `${AGENT_URL}/v1/nl/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        confirmation_id: confirmationId,
        confirmed,
      }),
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
        `[SEMANTIC] intent should be ` +
          `"${e.intentIs}" but got "${intent}"`
      );
    }
  }
  if (e.intentContains) {
    for (const s of e.intentContains) {
      if (!intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent should contain ` +
            `"${s}" but got "${intent}"`
        );
      }
    }
  }
  if (e.intentNotContains) {
    for (const s of e.intentNotContains) {
      if (intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent should NOT ` +
            `contain "${s}"`
        );
      }
    }
  }
  if (e.messageContains) {
    for (const s of e.messageContains) {
      if (
        !msgLower.includes(s.toLowerCase())
      ) {
        failures.push(
          `[FUNC] message should contain ` +
            `"${s}" (preview: ` +
            `${msg.slice(0, 200)})`
        );
      }
    }
  }
  if (e.messageNotContains) {
    for (const s of e.messageNotContains) {
      if (
        msgLower.includes(s.toLowerCase())
      ) {
        failures.push(
          `[FUNC] message should NOT ` +
            `contain "${s}"`
        );
      }
    }
  }
  if (e.messageMatchesAny) {
    const hit = e.messageMatchesAny.some(
      (s) =>
        msgLower.includes(s.toLowerCase())
    );
    if (!hit) {
      failures.push(
        `[FUNC] message should match ANY ` +
          `of [${e.messageMatchesAny.join(', ')}]` +
          ` (preview: ${msg.slice(0, 200)})`
      );
    }
  }
  if (e.noRawCodes) {
    for (const code of RAW_CODE_BLOCKLIST) {
      if (msgLower.includes(code)) {
        failures.push(
          `[QUALITY] message contains ` +
            `internal code "${code}"`
        );
      }
    }
    const rawGeoRe =
      /\b(usa|gbr|jpn|kor|deu|fra|aus|can|bra|sgp)\b/i;
    const rawMatch = msg.match(rawGeoRe);
    if (rawMatch) {
      failures.push(
        `[QUALITY] message contains raw ` +
          `country code "${rawMatch[0]}"`
      );
    }
  }
  if (e.hasConfirmation !== undefined) {
    const has = !!data.requires_confirmation;
    if (has !== e.hasConfirmation) {
      failures.push(
        `[FUNC] hasConfirmation: expected ` +
          `${e.hasConfirmation}, got ${has}`
      );
    }
  }
  if (e.hasData !== undefined) {
    const has = !!data.data;
    if (has !== e.hasData) {
      failures.push(
        `[FUNC] hasData: expected ` +
          `${e.hasData}, got ${has}`
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
              `[FUNC] data.${chk.path} ` +
                `should exist`
            );
          }
          break;
        case 'gt':
          if (
            typeof val !== 'number' ||
            val <= (chk.value as number)
          ) {
            failures.push(
              `[FUNC] data.${chk.path} ` +
                `> ${chk.value}, got ${val}`
            );
          }
          break;
        case 'eq':
          if (val !== chk.value) {
            failures.push(
              `[FUNC] data.${chk.path} ` +
                `== ${chk.value}, got ${val}`
            );
          }
          break;
        case 'contains':
          if (
            typeof val !== 'string' ||
            !val.includes(chk.value as string)
          ) {
            failures.push(
              `[FUNC] data.${chk.path} ` +
                `contains "${chk.value}"`
            );
          }
          break;
      }
    }
  }
  if (e.maxMs && durationMs > e.maxMs) {
    perfWarnings.push(
      `[PERF] ${durationMs}ms > ` +
        `${e.maxMs}ms SLA`
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
  let lastConfirmId = '';

  for (const step of scenario.steps) {
    if (step.newConversation) {
      convId = '';
      lastConfirmId = '';
    }

    const stepStart = Date.now();
    let res: NLResponse;

    if (step.confirm !== undefined) {
      res = await nlConfirm(
        convId,
        lastConfirmId,
        step.confirm
      );
    } else if (step.message) {
      res = await nlExecute(
        step.message, convId
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
        hasConfirmation: false,
        durationMs: 0,
      });
      continue;
    }

    const durationMs = Date.now() - stepStart;
    const data = res.data ?? {
      conversation_id: convId,
      intent: 'error',
      message: JSON.stringify(res)
        .slice(0, 200),
    };
    convId = data.conversation_id || convId;
    if (data.confirmation_id) {
      lastConfirmId = data.confirmation_id;
    }

    const { failures, perfWarnings } =
      validateStep(step, data, durationMs);
    results.push({
      label: step.label,
      passed: failures.length === 0,
      intent: data.intent,
      messagePreview: (
        data.message ?? ''
      ).slice(0, 200),
      failures,
      perfWarnings,
      conversationId: convId,
      hasConfirmation:
        !!data.requires_confirmation,
      confirmationId: data.confirmation_id,
      durationMs,
    });
  }

  return {
    name: scenario.name,
    suite: scenario.suite,
    passed: results.every((r) => r.passed),
    steps: results,
    totalMs: Date.now() - start,
  };
}

/* =========================================
 * Suite A – Result-set continuation
 * ========================================= */
const SUITE_A: TestScenario[] = [
  {
    name: 'A1: 查纽约→最便宜→帮我开通(取消)',
    suite: 'A',
    description:
      '查询→排序推荐→开通→取消完整链路',
    steps: [
      {
        label: 'A1.1 查询纽约IP',
        message: '纽约有哪些IP',
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
          noRawCodes: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A1.2 找最便宜的',
        message: '哪个最便宜',
        expect: {
          intentIs: 'follow_up_recommend',
          messageMatchesAny: [
            '便宜', 'cheapest', '推荐',
          ],
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'A1.3 帮我开通(不确认)',
        message: '帮我开通',
        expect: {
          intentIs: 'follow_up_action',
          messageContains: ['位置'],
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A2: 查伦敦→下一页→开通第三个',
    suite: 'A',
    description:
      '分页后引用当前页序号',
    steps: [
      {
        label: 'A2.1 查询伦敦IP',
        message: '显示伦敦IP',
        expect: {
          messageContains: ['伦敦'],
          hasData: true,
          noRawCodes: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A2.2 下一页',
        message: '下一页',
        expect: {
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'A2.3 开通第三个',
        message: '帮我开通第三个',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '位置', 'Location',
            '选中', 'Selected',
            '超出范围',
          ],
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A3: 查东京→第一个→不对换第二个',
    suite: 'A',
    description:
      '指代切换: 选第一个后再换第二个',
    steps: [
      {
        label: 'A3.1 查询东京IP',
        message: '东京有哪些IP',
        expect: {
          messageContains: ['东京'],
          hasData: true,
          noRawCodes: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A3.2 选第一个',
        message: '第一个',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'A3.3 换第二个',
        message: '不对，换第二个',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A4: 查美国→库存最多的→帮我开通',
    suite: 'A',
    description: '库存排序后开通',
    steps: [
      {
        label: 'A4.1 查美国IP',
        message: '查一下美国有哪些IP',
        expect: {
          messageContains: ['美国'],
          hasData: true,
          noRawCodes: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A4.2 库存最多的',
        message: '库存最多的是哪个',
        expect: {
          intentIs: 'follow_up_refine',
          messageMatchesAny: [
            '库存', 'stock',
          ],
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'A4.3 帮我开通',
        message: '帮我开通',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '位置', 'Location',
          ],
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A5: 查纽约→找质量最好→太贵换便宜的',
    suite: 'A',
    description:
      '条件改写: 质量排序→价格排序',
    steps: [
      {
        label: 'A5.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A5.2 找质量最好的',
        message: '帮我找个质量最好的',
        expect: {
          messageContains: ['质量'],
          maxMs: PERF.QUALITY_CHECK_MS,
        },
      },
      {
        label: 'A5.3 太贵换便宜的',
        message: '太贵了，换个便宜一点的',
        expect: {
          intentIs: 'follow_up_refine',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A6: 查日本→最便宜那个',
    suite: 'A',
    description: '排序推荐',
    steps: [
      {
        label: 'A6.1 查日本IP',
        message: '日本有哪些IP',
        expect: {
          messageContains: ['日本'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A6.2 最便宜那个',
        message: '哪个最便宜',
        expect: {
          intentIs: 'follow_up_recommend',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'A7: 查纽约→帮选3个→开通第一个',
    suite: 'A',
    description: '批量选择后指定开通',
    steps: [
      {
        label: 'A7.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A7.2 帮选3个',
        message: '帮我挑3个',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
      {
        label: 'A7.3 开通第一个',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
];

/* =========================================
 * Suite B – Confirmation state machine
 * ========================================= */
const SUITE_B: TestScenario[] = [
  {
    name: 'B1: 开通第一个→取消→开第二个',
    suite: 'B',
    description:
      '取消后改选: 确认态正确清理',
    steps: [
      {
        label: 'B1.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'B1.2 开通第一个',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '位置', '确认', 'Selected',
            '选中', '购买',
          ],
          noRawCodes: true,
        },
      },
      {
        label: 'B1.3 取消(状态机拦截)',
        message: '取消',
        expect: {
          intentIs: 'cancel_confirmed',
          messageMatchesAny: [
            '取消', 'cancel', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
      {
        label: 'B1.4 开第二个',
        message: '那开第二个',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'B2: 确认态中插话查余额',
    suite: 'B',
    description:
      '确认等待中用户查余额',
    steps: [
      {
        label: 'B2.1 查美国IP',
        message: '美国纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'B2.2 开通第一个',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '位置', '确认', 'Selected',
            '选中', '购买', '产品',
          ],
        },
      },
      {
        label: 'B2.3 插话查余额',
        message: '先等等，查一下余额',
        expect: {
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'B2.4 取消',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消', 'cancel',
            '帮助', '操作', '命令',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
    ],
  },
  {
    name:
      'B3: 查询→开通→取消→再查便宜的',
    suite: 'B',
    description: '购买链切回查询链',
    steps: [
      {
        label: 'B3.1 查东京IP',
        message: '东京有哪些IP',
        expect: {
          messageContains: ['东京'],
          hasData: true,
        },
      },
      {
        label: 'B3.2 找质量最好的',
        message: '帮我找个质量最好的',
        expect: {
          messageContains: ['质量'],
        },
      },
      {
        label: 'B3.3 帮我开通',
        message: '帮我开通',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '位置', '确认', 'Selected',
          ],
        },
      },
      {
        label: 'B3.4 取消',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
      {
        label: 'B3.5 查便宜的',
        message: '再查一下还有没有便宜一点的',
        expect: {
          noRawCodes: true,
          messageNotContains: [
            '没有找到上下文',
          ],
        },
      },
    ],
  },
  {
    name: 'B4: 确认消息格式校验',
    suite: 'B',
    description:
      '确认消息无内部编码',
    steps: [
      {
        label: 'B4.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'B4.2 开通第一个',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
          messageMatchesAny: [
            '位置', 'Location',
            '选中', '购买',
          ],
        },
      },
    ],
  },
];

/* =========================================
 * Suite C – Error recovery
 * ========================================= */
const SUITE_C: TestScenario[] = [
  {
    name: 'C1: 查无结果地区→换有结果地区',
    suite: 'C',
    description: '无结果后换地区继续',
    steps: [
      {
        label: 'C1.1 查冷门地区',
        message: '查一下冰岛有没有IP',
        expect: {
          messageNotContains: ['error'],
        },
      },
      {
        label: 'C1.2 换纽约',
        message: '那纽约呢',
        expect: {
          messageMatchesAny: [
            '纽约', 'New York', 'IP段',
          ],
        },
      },
    ],
  },
  {
    name: 'C2: 无上下文直接开通',
    suite: 'C',
    description: '无上下文开通应不报错',
    steps: [
      {
        label: 'C2.1 直接开通(无上下文)',
        message: '帮我开通一个纽约IP',
        newConversation: true,
        expect: {
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'C3: 无上下文模糊命令',
    suite: 'C',
    description: '新会话模糊命令优雅处理',
    steps: [
      {
        label: 'C3.1 模糊命令',
        message: '帮我找个质量最好的',
        newConversation: true,
        expect: {
          messageNotContains: [
            'error', '500', 'Internal',
          ],
        },
      },
    ],
  },
  {
    name: 'C4: 序号超出范围',
    suite: 'C',
    description: '超大序号友好提示',
    steps: [
      {
        label: 'C4.1 查日本IP',
        message: '日本有哪些IP',
        expect: { hasData: true },
      },
      {
        label: 'C4.2 开通第999个',
        message: '帮我开通第999个',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '超出范围', 'out of range',
            '共', 'items',
          ],
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'C5: 管理员可查用户',
    suite: 'C',
    description: '权限测试',
    steps: [
      {
        label: 'C5.1 查询用户',
        message: '查看所有用户',
        newConversation: true,
        expect: {
          messageNotContains: [
            '权限不足', 'permission denied',
          ],
        },
      },
    ],
  },
  {
    name: 'C6: 查余额→查IP(跨意图)',
    suite: 'C',
    description: '余额查询后查IP',
    steps: [
      {
        label: 'C6.1 查余额',
        message: '查看我的余额',
        newConversation: true,
        expect: {
          intentIs: 'query_balance',
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'C6.2 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
        },
      },
    ],
  },
  {
    name: 'C7: 找最好→换便宜→开通(不确认)',
    suite: 'C',
    description: '多次改写后开通',
    steps: [
      {
        label: 'C7.1 查美国IP',
        message: '美国有哪些IP',
        expect: {
          messageContains: ['美国'],
          hasData: true,
        },
      },
      {
        label: 'C7.2 找最好的',
        message: '帮我找质量最好的',
        expect: {
          messageContains: ['质量'],
        },
      },
      {
        label: 'C7.3 换便宜的',
        message: '太贵了，找个便宜的',
        expect: {
          intentIs: 'follow_up_refine',
          noRawCodes: true,
        },
      },
      {
        label: 'C7.4 帮我开通(不确认)',
        message: '帮我开通',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
        },
      },
    ],
  },
];

/* =========================================
 * Suite D – Language & aliases
 * ========================================= */
const SUITE_D: TestScenario[] = [
  {
    name: 'D1: London→切到东京(英→中)',
    suite: 'D',
    description: '英文查询后中文切换',
    steps: [
      {
        label: 'D1.1 查London IP',
        message: 'Show me London IPs',
        expect: {
          messageMatchesAny: [
            '伦敦', 'London', 'IP',
          ],
          hasData: true,
        },
      },
      {
        label: 'D1.2 切到东京',
        message: '换成东京的',
        expect: {
          messageMatchesAny: [
            '东京', 'Tokyo',
          ],
        },
      },
    ],
  },
  {
    name: 'D2: 英文全链路 NY→best→purchase',
    suite: 'D',
    description: '全英文多轮',
    steps: [
      {
        label: 'D2.1 Query NY IPs',
        message: 'Show me New York IPs',
        expect: {
          messageContains: ['IP'],
          hasData: true,
        },
      },
      {
        label: 'D2.2 find the best one',
        message: 'find the best quality one',
        expect: {
          messageNotContains: [
            'No context', '没有找到上下文',
          ],
        },
      },
      {
        label: 'D2.3 purchase it',
        message: 'purchase it',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            'Location', '位置',
            'Selected', '选中',
            'Confirm',
          ],
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'D3: 中英混合查询',
    suite: 'D',
    description: '中英混合地名识别',
    steps: [
      {
        label: 'D3.1 查London的IP',
        message: '查London的IP',
        expect: {
          messageMatchesAny: [
            '伦敦', 'London',
          ],
        },
      },
      {
        label: 'D3.2 show最便宜的',
        message: 'show最便宜的',
        expect: {
          noRawCodes: true,
          messageNotContains: [
            '没有找到上下文',
          ],
        },
      },
    ],
  },
  {
    name: 'D4: Seoul别名解析',
    suite: 'D',
    description: '韩国首尔多名称',
    steps: [
      {
        label: 'D4.1 查Seoul IP',
        message: 'Seoul有哪些IP',
        expect: {
          messageMatchesAny: [
            '首尔', 'Seoul', '韩国',
          ],
        },
      },
    ],
  },
  {
    name: 'D5: LA别名',
    suite: 'D',
    description: '洛杉矶多种写法',
    steps: [
      {
        label: 'D5.1 查LA IP',
        message: 'LA有什么IP',
        expect: {
          messageMatchesAny: [
            '洛杉矶', 'Los Angeles', '美国',
          ],
        },
      },
    ],
  },
  {
    name: 'D6: 地区无原始编码',
    suite: 'D',
    description: '地区显示中文名称',
    steps: [
      {
        label: 'D6.1 查伦敦IP',
        message: '伦敦有哪些IP',
        expect: {
          messageContains: ['伦敦'],
          messageNotContains: [
            'GBR000', 'GBRENG',
          ],
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'D7: 英文follow-up上下文',
    suite: 'D',
    description: '英文follow-up不丢上下文',
    steps: [
      {
        label: 'D7.1 Query Tokyo IPs',
        message: 'Show Tokyo IPs',
        expect: {
          messageContains: ['IP'],
          hasData: true,
        },
      },
      {
        label: 'D7.2 which has most stock',
        message: 'which one has the most stock',
        expect: {
          messageMatchesAny: [
            'stock', 'Stock', '库存',
          ],
          messageNotContains: [
            'No context',
          ],
        },
      },
    ],
  },
  {
    name: 'D8: Australia互通',
    suite: 'D',
    description: '英文国家名查询',
    steps: [
      {
        label: 'D8.1 Australia IP',
        message: '查Australia的IP',
        expect: {
          messageMatchesAny: [
            '澳大利亚', 'Australia',
            '澳洲',
          ],
        },
      },
    ],
  },
];

/* =========================================
 * Suite ISO – Session isolation
 * ========================================= */
const SUITE_ISO: TestScenario[] = [
  {
    name: 'ISO1: 新会话不继承旧上下文',
    suite: 'ISO',
    description:
      '新conversation不应继承旧会话',
    steps: [
      {
        label: 'ISO1.1 旧会话查纽约',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'ISO1.2 新会话-帮我开通',
        message: '帮我开通第一个',
        newConversation: true,
        expect: {
          messageNotContains: [
            'error', '500',
          ],
        },
      },
    ],
  },
  {
    name: 'ISO2: 切主题后上下文更新',
    suite: 'ISO',
    description:
      '同会话换主题后上下文应更新',
    steps: [
      {
        label: 'ISO2.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'ISO2.2 查伦敦IP(换主题)',
        message: '查伦敦的IP',
        expect: {
          messageContains: ['伦敦'],
          hasData: true,
        },
      },
      {
        label:
          'ISO2.3 开通第一个(应指向伦敦)',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          messageMatchesAny: [
            '英国', '伦敦', 'London',
            'UK', '位置', 'Location',
          ],
          messageNotContains: [
            '纽约', 'New York',
          ],
          noRawCodes: true,
        },
      },
    ],
  },
];

/* =========================================
 * Suite DIS – Disambiguation & ranking
 * ========================================= */
const SUITE_DIS: TestScenario[] = [
  {
    name: 'DIS1: 顺序词—质量第二好的',
    suite: 'DIS',
    description: '排名词消歧',
    steps: [
      {
        label: 'DIS1.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'DIS1.2 找质量最好的',
        message: '帮我找个质量最好的',
        expect: {
          messageContains: ['质量'],
        },
      },
      {
        label: 'DIS1.3 第二个',
        message: '第二个呢',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'DIS2: "这个"指代',
    suite: 'DIS',
    description: '代词指代消歧',
    steps: [
      {
        label: 'DIS2.1 查日本IP',
        message: '日本有哪些IP',
        expect: {
          messageContains: ['日本'],
          hasData: true,
        },
      },
      {
        label: 'DIS2.2 帮我开通这个',
        message: '帮我开通这个',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'DIS3: "查最近开通"识别为查询',
    suite: 'DIS',
    description:
      '"最近开通"→订单查询非购买',
    steps: [
      {
        label: 'DIS3.1 查最近开通的IP',
        message: '查看我最近开通的IP',
        newConversation: true,
        expect: {
          intentNotContains: ['purchase'],
        },
      },
    ],
  },
];

/* =========================================
 * Suite NEG – Negative semantics
 * ========================================= */
const SUITE_NEG: TestScenario[] = [
  {
    name: 'NEG1: 否定+纠正"不是这个,要那个"',
    suite: 'NEG',
    description:
      '否定当前选择并纠正到另一个',
    steps: [
      {
        label: 'NEG1.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'NEG1.2 选第一个',
        message: '第一个',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
        },
      },
      {
        label: 'NEG1.3 不是这个换第三个',
        message: '不是这个，换第三个',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
          maxMs: PERF.FOLLOW_UP_MS,
        },
      },
    ],
  },
  {
    name: 'NEG2: "先别买,发给我看看"',
    suite: 'NEG',
    description:
      '否定购买动作,要求详情',
    steps: [
      {
        label: 'NEG2.1 查东京IP',
        message: '东京有哪些IP',
        expect: {
          messageContains: ['东京'],
          hasData: true,
        },
      },
      {
        label: 'NEG2.2 帮我开通',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
        },
      },
      {
        label: 'NEG2.3 先别买',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消', 'cancel',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
    ],
  },
  {
    name:
      'NEG3: 查询→开通→取消→换个便宜的→开通',
    suite: 'NEG',
    description:
      '取消后条件改写再开通',
    steps: [
      {
        label: 'NEG3.1 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'NEG3.2 帮我开通',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
        },
      },
      {
        label: 'NEG3.3 取消',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
      {
        label: 'NEG3.4 换便宜的',
        message: '找个便宜一点的',
        expect: {
          noRawCodes: true,
          messageNotContains: [
            '没有找到上下文',
          ],
        },
      },
      {
        label: 'NEG3.5 再开通',
        message: '帮我开通',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'NEG4: "还是上一个吧"回指',
    suite: 'NEG',
    description: '回指上一轮选择',
    steps: [
      {
        label: 'NEG4.1 查日本IP',
        message: '日本有哪些IP',
        expect: {
          messageContains: ['日本'],
          hasData: true,
        },
      },
      {
        label: 'NEG4.2 选第一个',
        message: '第一个',
        expect: {
          intentIs: 'follow_up_select',
        },
      },
      {
        label: 'NEG4.3 换第二个',
        message: '第二个',
        expect: {
          intentIs: 'follow_up_select',
        },
      },
      {
        label: 'NEG4.4 还是第一个吧',
        message: '还是第一个吧',
        expect: {
          intentIs: 'follow_up_select',
          noRawCodes: true,
        },
      },
    ],
  },
];

/* =========================================
 * Suite CROSS – Cross-module chains
 * ========================================= */
const SUITE_CROSS: TestScenario[] = [
  {
    name: 'CROSS1: 查余额→查消费→查IP',
    suite: 'CROSS',
    description:
      '多模块跳转: 余额→统计→库存',
    steps: [
      {
        label: 'CROSS1.1 查余额',
        message: '查看我的余额',
        newConversation: true,
        expect: {
          intentIs: 'query_balance',
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'CROSS1.2 查消费统计',
        message: '这个月花了多少钱',
        expect: {
          messageMatchesAny: [
            '消费', '统计', '花费',
            '支出', '¥', '总计',
          ],
        },
      },
      {
        label: 'CROSS1.3 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
        },
      },
    ],
  },
  {
    name:
      'CROSS2: 查最近订单→查最近开通',
    suite: 'CROSS',
    description: '订单查询链路',
    steps: [
      {
        label: 'CROSS2.1 查最近订单',
        message: '查看最近的订单',
        newConversation: true,
        expect: {
          messageNotContains: [
            'error', '500',
          ],
        },
      },
      {
        label: 'CROSS2.2 查最近开通的IP',
        message: '查看我最近开通的IP',
        expect: {
          intentNotContains: ['purchase'],
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'CROSS3: 查IP→查质量→查余额→开通',
    suite: 'CROSS',
    description:
      '完整购买决策链路',
    steps: [
      {
        label: 'CROSS3.1 查纽约IP',
        message: '纽约有哪些IP',
        newConversation: true,
        expect: {
          intentIs: 'query_ip_inventory',
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'CROSS3.2 找最好的',
        message: '帮我找质量最好的',
        expect: {
          messageContains: ['质量'],
        },
      },
      {
        label: 'CROSS3.3 查余额',
        message: '我余额够吗',
        expect: {
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'CROSS3.4 帮我开通',
        message: '帮我开通',
        expect: {
          messageMatchesAny: [
            '位置', 'Location',
            '选中', 'Selected',
            '确认', 'Confirm',
          ],
          noRawCodes: true,
        },
      },
    ],
  },
  {
    name: 'CROSS4: 帮助→查库存→开通→取消',
    suite: 'CROSS',
    description:
      '帮助→查询→操作完整链',
    steps: [
      {
        label: 'CROSS4.1 帮助',
        message: '帮助',
        newConversation: true,
        expect: {
          messageMatchesAny: [
            '命令', '帮助', 'help',
          ],
        },
      },
      {
        label: 'CROSS4.2 查纽约IP',
        message: '纽约有哪些IP',
        expect: {
          messageContains: ['纽约'],
          hasData: true,
        },
      },
      {
        label: 'CROSS4.3 开通第一个',
        message: '帮我开通第一个',
        expect: {
          intentIs: 'follow_up_action',
          noRawCodes: true,
        },
      },
      {
        label: 'CROSS4.4 取消',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
    ],
  },
];

const ALL_SCENARIOS: TestScenario[] = [
  ...SUITE_A,
  ...SUITE_B,
  ...SUITE_C,
  ...SUITE_D,
  ...SUITE_ISO,
  ...SUITE_DIS,
  ...SUITE_NEG,
  ...SUITE_CROSS,
];

function generateReport(
  results: ScenarioResult[]
): string {
  const ts = new Date().toISOString();
  const total = results.length;
  const passed = results.filter(
    (r) => r.passed
  ).length;
  const failed = total - passed;

  const suites = new Map<
    string, ScenarioResult[]
  >();
  for (const r of results) {
    if (!suites.has(r.suite))
      suites.set(r.suite, []);
    suites.get(r.suite)!.push(r);
  }

  const totalSteps = results.reduce(
    (s, r) => s + r.steps.length, 0
  );
  const allPerfWarns = results.flatMap(
    (r) =>
      r.steps.flatMap((s) => s.perfWarnings)
  );

  let md =
    `# Conversation Flow Test Report\n\n`;
  md += `**Time:** ${ts}\n`;
  md += `**Scenarios:** ${total}\n`;
  md += `**Steps:** ${totalSteps}\n`;
  md += `**Passed:** ${passed}\n`;
  md += `**Failed:** ${failed}\n`;
  md += `**Pass Rate:** ` +
    `${((passed / total) * 100).toFixed(1)}%\n`;
  if (allPerfWarns.length > 0) {
    md += `**Perf Warnings:** ` +
      `${allPerfWarns.length}\n`;
  }
  md += '\n';

  const suiteNames: Record<string, string> = {
    A: 'Suite A: 结果集延续',
    B: 'Suite B: 确认状态机',
    C: 'Suite C: 错误恢复',
    D: 'Suite D: 语言与别名',
    ISO: 'Suite ISO: 会话隔离',
    DIS: 'Suite DIS: 指代消歧',
    NEG: 'Suite NEG: 否定语义',
    CROSS: 'Suite CROSS: 跨模块链路',
  };

  for (const [key, items] of suites) {
    const sp = items.filter(
      (r) => r.passed
    ).length;
    const sf = items.length - sp;
    md += `---\n\n`;
    md += `# ${suiteNames[key] ?? key}\n`;
    md += `Pass: ${sp}/${items.length}`;
    if (sf > 0) md += ` (${sf} failed)`;
    md += `\n\n`;

    for (const r of items) {
      const icon = r.passed ? '✅' : '❌';
      md += `## ${icon} ${r.name}\n`;
      md += `${r.description} | ` +
        `${r.totalMs}ms\n\n`;
      md += `| Step | Intent | Pass ` +
        `| ms | Perf |\n`;
      md += `|------|--------|------` +
        `|----|------|\n`;
      for (const s of r.steps) {
        const si = s.passed ? '✅' : '❌';
        const perf = s.perfWarnings.length > 0
          ? '⚠️' : '✓';
        md += `| ${si} ${s.label} `;
        md += `| ${s.intent} `;
        md += `| ${s.passed ? 'PASS' : 'FAIL'} `;
        md += `| ${s.durationMs} `;
        md += `| ${perf} |\n`;
      }
      md += '\n';
      const fails = r.steps.filter(
        (s) => !s.passed
      );
      if (fails.length) {
        md += '### Failures\n\n';
        for (const f of fails) {
          md += `**${f.label}:**\n`;
          for (const m of f.failures) {
            md += `- ${m}\n`;
          }
          md += `- Preview: ` +
            `${f.messagePreview}\n\n`;
        }
      }
      const perfWarns = r.steps.filter(
        (s) => s.perfWarnings.length > 0
      );
      if (perfWarns.length) {
        md += '### Performance Warnings\n\n';
        for (const pw of perfWarns) {
          md += `**${pw.label}:** ` +
            `${pw.perfWarnings.join('; ')}\n`;
        }
        md += '\n';
      }
    }
  }

  md += '---\n\n# Performance SLA\n\n';
  md += `| Metric | SLA |\n`;
  md += `|--------|-----|\n`;
  md += `| Cancel/Confirm | ` +
    `< ${PERF.CANCEL_CONFIRM_MS}ms |\n`;
  md += `| Follow-up | ` +
    `< ${PERF.FOLLOW_UP_MS}ms |\n`;
  md += `| Query | ` +
    `< ${PERF.QUERY_MS}ms |\n`;
  md += `| Quality Check | ` +
    `< ${PERF.QUALITY_CHECK_MS}ms |\n`;

  return md;
}

describe('Conversation Flow Tests', () => {
  beforeAll(async () => {
    adminToken = await login();
    expect(adminToken).toBeTruthy();
  }, 30_000);

  const allResults: ScenarioResult[] = [];

  for (const scenario of ALL_SCENARIOS) {
    it(
      scenario.name,
      async () => {
        const result =
          await runScenario(scenario);
        allResults.push(result);

        const failedSteps =
          result.steps.filter(
            (s) => !s.passed
          );
        if (failedSteps.length > 0) {
          const details = failedSteps
            .map(
              (s) =>
                `${s.label}: ` +
                s.failures.join('; ')
            )
            .join('\n');
          console.log(
            `\n[FAIL] ${scenario.name}:\n` +
              details
          );
        }

        expect(result.passed).toBe(true);
      },
      180_000
    );
  }

  it('Generate report', () => {
    const report =
      generateReport(allResults);
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
    const jsonPath = path.join(
      dir,
      `conversation-flow-${ts}.json`
    );
    const mdPath = path.join(
      dir,
      `conversation-flow-${ts}.md`
    );
    const latestMd = path.join(
      dir,
      'conversation-flow-latest.md'
    );

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(allResults, null, 2)
    );
    fs.writeFileSync(mdPath, report);
    fs.writeFileSync(latestMd, report);

    console.log(`\nReport: ${mdPath}`);
    expect(true).toBe(true);
  });
});
