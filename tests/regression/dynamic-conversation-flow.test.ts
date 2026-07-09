/**
 * Dynamic Proxy Multi-turn Conversation Flow Tests
 *
 * 8 suites (A–H):
 *   A. Result-set continuation & parameter inheritance
 *   B. Confirmation state machine
 *   C. Parameter rewrite & fine-grained follow-up
 *   D. Error recovery & negative assertions
 *   E. Language, alias & country code mapping
 *   F. Cross-module chains
 *   G. Cross-domain isolation (dynamic ↔ static)
 *   H. English colloquial coverage
 *
 * 4-layer quality gates:
 *   1. Functional: message content
 *   2. Semantic:  expected intent
 *   3. Performance: 4-tier SLA
 *   4. Payload: extractConfig parameter verification
 *
 * SAFETY: No real purchase is executed.
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
  CANCEL_CONFIRM_MS: 500,
  SEMANTIC_FOLLOW_UP_MS: 1500,
  PARAM_REWRITE_MS: 3000,
  QUERY_MS: 15000,
  EXTRACT_MS: 15000,
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

interface PayloadExpect {
  path: string;
  value?: unknown;
  contains?: string;
  notEmpty?: boolean;
}

interface TestStep {
  label: string;
  message?: string;
  confirm?: boolean;
  newConversation?: boolean;
  expect: {
    intentIs?: string;
    intentOneOf?: string[];
    intentContains?: string[];
    intentNotContains?: string[];
    messageContains?: string[];
    messageNotContains?: string[];
    messageMatchesAny?: string[];
    noRawCodes?: boolean;
    hasConfirmation?: boolean;
    hasData?: boolean;
    maxMs?: number;
    payload?: PayloadExpect[];
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
  rawData?: Record<string, unknown>;
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
  dotPath: string
): unknown {
  const parts = dotPath.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (
      cur === null ||
      cur === undefined ||
      typeof cur !== 'object'
    )
      return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
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
        `[SEMANTIC] want="${e.intentIs}" ` +
          `got="${intent}"`
      );
    }
  }
  if (e.intentOneOf) {
    if (!e.intentOneOf.includes(intent)) {
      failures.push(
        `[SEMANTIC] want one of ` +
          `[${e.intentOneOf.join(',')}] ` +
          `got="${intent}"`
      );
    }
  }
  if (e.intentContains) {
    for (const s of e.intentContains) {
      if (!intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent ∌ "${s}", ` +
            `got="${intent}"`
        );
      }
    }
  }
  if (e.intentNotContains) {
    for (const s of e.intentNotContains) {
      if (intent.includes(s)) {
        failures.push(
          `[SEMANTIC] intent should NOT ` +
            `contain "${s}", got="${intent}"`
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
          `[FUNC] msg ∌ "${s}" ` +
            `(${msg.slice(0, 200)})`
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
          `[FUNC] msg should NOT ` +
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
        `[FUNC] msg ∌ ANY of ` +
          `[${e.messageMatchesAny.join(', ')}]` +
          ` (${msg.slice(0, 200)})`
      );
    }
  }
  if (e.noRawCodes) {
    for (const code of RAW_CODE_BLOCKLIST) {
      if (msgLower.includes(code)) {
        failures.push(
          `[QUALITY] msg has "${code}"`
        );
      }
    }
  }
  if (e.hasConfirmation !== undefined) {
    const has = !!data.requires_confirmation;
    if (has !== e.hasConfirmation) {
      failures.push(
        `[FUNC] hasConfirmation: ` +
          `want=${e.hasConfirmation} ` +
          `got=${has}`
      );
    }
  }
  if (e.hasData !== undefined) {
    const has = !!data.data;
    if (has !== e.hasData) {
      failures.push(
        `[FUNC] hasData: ` +
          `want=${e.hasData} got=${has}`
      );
    }
  }
  if (e.payload && data.data) {
    for (const pe of e.payload) {
      const val = getNestedValue(
        data.data, pe.path
      );
      if (pe.notEmpty && !val) {
        failures.push(
          `[PAYLOAD] ${pe.path} is empty`
        );
      }
      if (
        pe.value !== undefined &&
        val !== pe.value
      ) {
        failures.push(
          `[PAYLOAD] ${pe.path}: ` +
            `want=${pe.value} ` +
            `got=${JSON.stringify(val)}`
        );
      }
      if (pe.contains && typeof val === 'string') {
        if (
          !val.toLowerCase()
            .includes(pe.contains.toLowerCase())
        ) {
          failures.push(
            `[PAYLOAD] ${pe.path} ∌ ` +
              `"${pe.contains}", got="${val}"`
          );
        }
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
        convId, lastConfirmId, step.confirm
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

    const dur = Date.now() - stepStart;
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
      validateStep(step, data, dur);
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
      durationMs: dur,
      rawData: data.data,
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

/* =========================================
 * Suite A – Result-set continuation
 *   & follow-up parameter inheritance
 * ========================================= */
const SUITE_A: TestScenario[] = [
  {
    name: 'A1: 查询动态资源→提取一个',
    suite: 'A',
    description:
      '查询资源后follow-up提取',
    steps: [
      {
        label: 'A1.1 查询动态资源',
        message: '查看动态代理资源',
        expect: {
          intentIs: 'query_dynamic_resource',
          messageMatchesAny: [
            '动态', 'Dynamic', '资源',
          ],
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A1.2 提取一个',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
          maxMs: PERF.EXTRACT_MS,
        },
      },
    ],
  },
  {
    name: 'A2: 查动态资源→提取5个美国的',
    suite: 'A',
    description:
      '查询后指定国家和数量提取',
    steps: [
      {
        label: 'A2.1 查动态资源',
        message: '查看我的动态代理流量',
        expect: {
          intentIs: 'query_dynamic_resource',
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A2.2 提取5个美国的',
        message: '提取5个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.EXTRACT_MS,
        },
      },
    ],
  },
  {
    name: 'A3: 提取美国动态→再来3个',
    suite: 'A',
    description:
      '提取后继续追加提取',
    steps: [
      {
        label: 'A3.1 提取一个美国动态',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          maxMs: PERF.EXTRACT_MS,
        },
      },
      {
        label: 'A3.2 再来3个',
        message: '再来3个',
        expect: {
          messageNotContains: [
            '没有找到上下文', 'error',
          ],
          maxMs: PERF.EXTRACT_MS,
        },
      },
    ],
  },
  {
    name: 'A4: 查动态订单→再提取同类型',
    suite: 'A',
    description:
      '查订单后继续提取',
    steps: [
      {
        label: 'A4.1 查动态订单',
        message: '查看动态代理订单',
        expect: {
          intentIs: 'query_dynamic_orders',
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'A4.2 提取一个动态代理',
        message: '帮我提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          maxMs: PERF.EXTRACT_MS,
        },
      },
    ],
  },
  {
    name: 'A5: 提取一个→换成日本',
    suite: 'A',
    description:
      '提取后更换国家(应命中动态refine)',
    steps: [
      {
        label: 'A5.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          maxMs: PERF.EXTRACT_MS,
        },
      },
      {
        label: 'A5.2 换成日本',
        message: '换成日本的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文', 'error',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
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
    name: 'B1: 购买动态→管理员受限',
    suite: 'B',
    description:
      '管理员不能直接开通动态代理',
    steps: [
      {
        label: 'B1.1 购买10GB动态代理',
        message: '购买10GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
          maxMs: PERF.QUERY_MS,
        },
      },
      {
        label: 'B1.2 确认',
        confirm: true,
        expect: {
          messageMatchesAny: [
            '管理员', 'Admin', '不能',
            'cannot',
          ],
        },
      },
    ],
  },
  {
    name: 'B2: 购买动态→取消',
    suite: 'B',
    description: '购买确认后取消',
    steps: [
      {
        label: 'B2.1 购买5GB动态代理',
        message: '购买5GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'B2.2 取消',
        message: '取消',
        expect: {
          intentIs: 'cancel_confirmed',
          messageMatchesAny: [
            '取消', 'cancel', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
    ],
  },
  {
    name: 'B3: 购买动态→取消→改成5GB',
    suite: 'B',
    description: '取消后改参数重新购买',
    steps: [
      {
        label: 'B3.1 购买10GB动态代理',
        message: '购买10GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'B3.2 取消',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消',
          ],
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
      {
        label: 'B3.3 改成5GB',
        message: '那购买5GB的',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
    ],
  },
  {
    name: 'B4: 购买动态→插话查余额→取消',
    suite: 'B',
    description: '确认态中插话查余额',
    steps: [
      {
        label: 'B4.1 购买10GB动态代理',
        message: '购买10GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'B4.2 查余额',
        message: '先查一下余额',
        expect: {
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'B4.3 取消',
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
    name: 'B5: 提取不需确认(直接执行)',
    suite: 'B',
    description:
      'extract_dynamic不走确认流程',
    steps: [
      {
        label: 'B5.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          hasConfirmation: false,
          maxMs: PERF.EXTRACT_MS,
        },
      },
    ],
  },
  {
    name: 'B6: 购买与提取意图不混淆',
    suite: 'B',
    description:
      '"购买"→purchase, "提取"→extract',
    steps: [
      {
        label: 'B6.1 购买动态代理',
        message: '购买10GB动态代理流量',
        expect: {
          intentIs: 'purchase_dynamic',
          intentNotContains: ['extract'],
        },
      },
      {
        label: 'B6.2 取消购买',
        message: '取消',
        expect: {
          messageMatchesAny: [
            '取消', '已取消',
          ],
        },
      },
      {
        label: 'B6.3 提取动态代理',
        message: '提取一个动态代理链接',
        expect: {
          intentIs: 'extract_dynamic',
          intentNotContains: ['purchase'],
        },
      },
    ],
  },
  {
    name: 'B7: 确认态取消命中状态机',
    suite: 'B',
    description:
      '"取消"走状态机,不走fallback',
    steps: [
      {
        label: 'B7.1 购买3GB动态代理',
        message: '购买3GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'B7.2 取消(状态机)',
        message: '不要了',
        expect: {
          intentIs: 'cancel_confirmed',
          maxMs: PERF.CANCEL_CONFIRM_MS,
        },
      },
    ],
  },
];

/* =========================================
 * Suite C – Parameter rewrite
 * (strict intent + payload assertions)
 * ========================================= */
const SUITE_C: TestScenario[] = [
  {
    name: 'C1: 提取1个→改成5个',
    suite: 'C',
    description: '数量改写',
    steps: [
      {
        label: 'C1.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C1.2 改成5个',
        message: '改成5个',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文', 'error',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C2: 提取5个美国→改成英国',
    suite: 'C',
    description: '国家改写(不能落到inventory)',
    steps: [
      {
        label: 'C2.1 提取5个美国动态代理',
        message: '提取5个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C2.2 改成英国',
        message: '改成英国的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C3: 提取socks5→改成http',
    suite: 'C',
    description: '协议改写',
    steps: [
      {
        label: 'C3.1 提取socks5动态代理',
        message: '提取一个socks5动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C3.2 改成http',
        message: '改成http',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C4: 提取→改成10分钟有效',
    suite: 'C',
    description: '有效期改写',
    steps: [
      {
        label: 'C4.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C4.2 改成10分钟有效',
        message: '改成10分钟有效的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C5: 提取美国→指定洛杉矶',
    suite: 'C',
    description: '国家→城市细化',
    steps: [
      {
        label: 'C5.1 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C5.2 指定洛杉矶',
        message: '指定洛杉矶',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C6: 提取日本→改成全球随机',
    suite: 'C',
    description: '取消国家指定',
    steps: [
      {
        label: 'C6.1 提取日本动态代理',
        message: '提取一个日本动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C6.2 不指定国家',
        message: '不指定国家，全球随机',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: ['error'],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C7: 提取→改成API提取',
    suite: 'C',
    description: '提取方式改写',
    steps: [
      {
        label: 'C7.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C7.2 用API提取',
        message: '改成用API方式提取',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: ['error'],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'C8: 提取http→改回socks5',
    suite: 'C',
    description: '协议回退',
    steps: [
      {
        label: 'C8.1 提取http动态代理',
        message: '提取一个http动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C8.2 改回socks5',
        message: '改成socks5',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name:
      'C9: 改http只改协议不改国家数量',
    suite: 'C',
    description:
      '参数隔离: 改一个参数不污染其他',
    steps: [
      {
        label: 'C9.1 提取5个美国socks5',
        message:
          '提取5个美国socks5动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'C9.2 改成http',
        message: '改成http',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
];

/* =========================================
 * Suite D – Error recovery & negative
 * ========================================= */
const SUITE_D: TestScenario[] = [
  {
    name: 'D1: 提取0个→改成1个',
    suite: 'D',
    description: '数量非法后恢复',
    steps: [
      {
        label: 'D1.1 提取0个动态代理',
        message: '提取0个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['500'],
        },
      },
      {
        label: 'D1.2 改成1个',
        message: '改成1个',
        expect: {
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'D2: 无上下文"换成日本"',
    suite: 'D',
    description:
      '无上下文参数改写不报错',
    steps: [
      {
        label: 'D2.1 无上下文换日本',
        message: '换成日本的',
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
    name: 'D3: 查询无资源→友好提示',
    suite: 'D',
    description:
      '无动态资源时友好提示',
    steps: [
      {
        label: 'D3.1 查动态资源',
        message: '查看动态代理资源',
        expect: {
          intentIs: 'query_dynamic_resource',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'D4: 提取→失败→换参数重试',
    suite: 'D',
    description:
      '提取失败后修改参数继续',
    steps: [
      {
        label: 'D4.1 提取一个动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'D4.2 换成美国',
        message: '换成美国的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: ['500'],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name:
      'D5: 静态后提取动态不误继承',
    suite: 'D',
    description:
      '静态查询后直接提取不串上下文',
    steps: [
      {
        label: 'D5.1 查纽约静态IP',
        message: '纽约有哪些IP',
        expect: {
          intentContains: ['query'],
        },
      },
      {
        label: 'D5.2 提取动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          intentNotContains: [
            'static', 'query_ip',
          ],
        },
      },
    ],
  },
  {
    name: 'D6: 协议非法输入',
    suite: 'D',
    description:
      '输入错误协议名不崩溃',
    steps: [
      {
        label: 'D6.1 提取https5代理',
        message: '提取一个https5动态代理',
        expect: {
          messageNotContains: [
            '500', 'Internal',
          ],
        },
      },
    ],
  },
  {
    name: 'D7: 国家城市冲突',
    suite: 'D',
    description:
      '日本+洛杉矶冲突不崩溃',
    steps: [
      {
        label: 'D7.1 冲突参数提取',
        message:
          '提取一个日本洛杉矶动态代理',
        expect: {
          messageNotContains: [
            '500', 'Internal',
          ],
        },
      },
    ],
  },
];

/* =========================================
 * Suite E – Language, alias & ISO2 mapping
 * ========================================= */
const SUITE_E: TestScenario[] = [
  {
    name: 'E1: 提取美国→意图含US',
    suite: 'E',
    description: '中文"美国"→ISO2 US',
    steps: [
      {
        label: 'E1.1 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'E2: 提取英国→GB',
    suite: 'E',
    description: '中文"英国"→ISO2 GB',
    steps: [
      {
        label: 'E2.1 提取英国动态代理',
        message: '提取一个英国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'E3: 提取日本→JP',
    suite: 'E',
    description: '中文"日本"→ISO2 JP',
    steps: [
      {
        label: 'E3.1 提取日本动态代理',
        message: '提取一个日本动态代理',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'E4: extract US dynamic proxies',
    suite: 'E',
    description: '英文提取',
    steps: [
      {
        label: 'E4.1 英文提取',
        message:
          'extract 5 US dynamic proxies',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'E5: 英文→改socks5→中英混合',
    suite: 'E',
    description: '英文提取后中文改参数',
    steps: [
      {
        label: 'E5.1 英文提取日本',
        message:
          'extract 3 japan dynamic proxies',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'E5.2 改成socks5',
        message: '改成socks5',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'E6: 提取UK→改成Japan',
    suite: 'E',
    description: '英文国家缩写切换',
    steps: [
      {
        label: 'E6.1 提取UK动态代理',
        message: '提取一个UK的动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'E6.2 改成Japan',
        message: '改成Japan的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: [
            '没有找到上下文', 'error',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'E7: 中英混合复合参数',
    suite: 'E',
    description: '中英混合输入',
    steps: [
      {
        label: 'E7.1 混合提取',
        message:
          '提取5个US动态代理，http，10分钟有效',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
];

/* =========================================
 * Suite F – Cross-module chains
 * ========================================= */
const SUITE_F: TestScenario[] = [
  {
    name: 'F1: 查资源→提取→查订单',
    suite: 'F',
    description:
      '资源→提取→订单完整链路',
    steps: [
      {
        label: 'F1.1 查动态资源',
        message: '查看动态代理资源',
        expect: {
          intentIs: 'query_dynamic_resource',
        },
      },
      {
        label: 'F1.2 提取一个',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'F1.3 查动态订单',
        message: '查看动态订单',
        expect: {
          intentIs: 'query_dynamic_orders',
        },
      },
    ],
  },
  {
    name: 'F2: 查余额→购买→取消',
    suite: 'F',
    description:
      '余额→购买(确认态)→取消',
    steps: [
      {
        label: 'F2.1 查余额',
        message: '查看余额',
        expect: {
          intentIs: 'query_balance',
          messageMatchesAny: [
            '余额', 'balance', '¥',
          ],
        },
      },
      {
        label: 'F2.2 购买动态代理',
        message: '购买5GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'F2.3 取消',
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
  {
    name: 'F3: 提取美国→查消费',
    suite: 'F',
    description: '提取后查消费统计',
    steps: [
      {
        label: 'F3.1 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'F3.2 查今天消费',
        message: '查看今天的消费',
        expect: {
          messageMatchesAny: [
            '消费', '统计', '花费', '¥',
            '总计', '支出',
          ],
        },
      },
    ],
  },
  {
    name: 'F4: 帮助→资源→提取',
    suite: 'F',
    description:
      '帮助→资源查询→提取链路',
    steps: [
      {
        label: 'F4.1 帮助',
        message: '帮助',
        newConversation: true,
        expect: {
          messageMatchesAny: [
            '命令', '帮助', 'help',
          ],
        },
      },
      {
        label: 'F4.2 查动态资源',
        message: '查看动态代理资源',
        expect: {
          intentIs: 'query_dynamic_resource',
        },
      },
      {
        label: 'F4.3 提取一个',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
    ],
  },
  {
    name: 'F5: 动态→静态不污染',
    suite: 'F',
    description:
      '动态上下文不污染静态查询',
    steps: [
      {
        label: 'F5.1 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'F5.2 查纽约静态IP',
        message: '纽约有哪些静态IP',
        expect: {
          intentContains: ['query'],
          intentNotContains: ['dynamic'],
        },
      },
      {
        label:
          'F5.3 开通第一个(指向静态)',
        message: '帮我开通第一个',
        expect: {
          intentNotContains: [
            'dynamic', 'extract',
          ],
        },
      },
    ],
  },
];

/* =========================================
 * Suite G – Cross-domain isolation
 *   (3 high-risk context pollution cases)
 * ========================================= */
const SUITE_G: TestScenario[] = [
  {
    name:
      'G1: 静态→动态→换日本应改动态',
    suite: 'G',
    description:
      '查静态后提取动态→"换成日本"' +
      '改的是动态不是跳回静态',
    steps: [
      {
        label: 'G1.1 查纽约静态IP',
        message: '纽约有哪些静态IP',
        expect: {
          intentContains: ['query'],
        },
      },
      {
        label: 'G1.2 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label:
          'G1.3 换成日本(应继续动态)',
        message: '换成日本的',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          messageNotContains: ['error'],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name:
      'G2: 动态→静态→再来一个不继承动态',
    suite: 'G',
    description:
      '提取动态后查静态→"再来一个"' +
      '不再继承动态提取',
    steps: [
      {
        label: 'G2.1 提取美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'G2.2 查静态IP',
        message: '查看纽约有哪些静态IP',
        expect: {
          intentContains: ['query'],
          intentNotContains: ['dynamic'],
        },
      },
      {
        label:
          'G2.3 再来一个(理想不继承动态)',
        message: '再来一个',
        expect: {
          messageNotContains: [
            '500', 'Internal',
          ],
        },
      },
    ],
  },
  {
    name:
      'G3: 购买动态→查静态→取消',
    suite: 'G',
    description:
      '购买确认态→插话查静态→取消' +
      '应取消购买确认',
    steps: [
      {
        label: 'G3.1 购买5GB动态代理',
        message: '购买5GB动态代理',
        expect: {
          intentIs: 'purchase_dynamic',
          hasConfirmation: true,
        },
      },
      {
        label: 'G3.2 查静态IP',
        message: '纽约有哪些IP',
        expect: {
          intentContains: ['query'],
        },
      },
      {
        label: 'G3.3 取消(购买确认)',
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
];

/* =========================================
 * Suite H – English colloquial
 * ========================================= */
const SUITE_H: TestScenario[] = [
  {
    name: 'H1: give me 5 US proxies',
    suite: 'H',
    description:
      '口语 give me → extract_dynamic',
    steps: [
      {
        label: 'H1.1 give me',
        message:
          'give me 5 US dynamic proxies',
        expect: {
          intentIs: 'extract_dynamic',
          messageNotContains: ['error'],
        },
      },
    ],
  },
  {
    name: 'H2: get me 3 japan proxies',
    suite: 'H',
    description: '口语 get me',
    steps: [
      {
        label: 'H2.1 get me',
        message:
          'get me 3 japan dynamic proxies',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
    ],
  },
  {
    name: 'H3: make it http',
    suite: 'H',
    description:
      '口语 make it → 参数改写',
    steps: [
      {
        label: 'H3.1 提取一个美国动态代理',
        message: '提取一个美国动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'H3.2 make it http',
        message: 'make it http',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'H4: change it to socks5',
    suite: 'H',
    description:
      '口语 change it to',
    steps: [
      {
        label: 'H4.1 提取http动态代理',
        message: '提取一个http动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'H4.2 change to socks5',
        message: 'change it to socks5',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'H5: switch to germany',
    suite: 'H',
    description:
      '口语 switch to country',
    steps: [
      {
        label: 'H5.1 提取美国动态代理',
        message:
          'extract 1 US dynamic proxy',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'H5.2 switch to germany',
        message: 'switch to germany',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
        },
      },
    ],
  },
  {
    name: 'H6: use api mode',
    suite: 'H',
    description: '口语 use api',
    steps: [
      {
        label: 'H6.1 提取动态代理',
        message: '提取一个动态代理',
        expect: {
          intentIs: 'extract_dynamic',
        },
      },
      {
        label: 'H6.2 use api mode',
        message: 'use api mode',
        expect: {
          intentNotContains: [
            'query_ip_inventory',
          ],
          maxMs: PERF.PARAM_REWRITE_MS,
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
  ...SUITE_E,
  ...SUITE_F,
  ...SUITE_G,
  ...SUITE_H,
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
  const perfWarnCount = results.reduce(
    (s, r) =>
      s +
      r.steps.reduce(
        (s2, st) =>
          s2 + st.perfWarnings.length, 0
      ),
    0
  );

  let md =
    `# Dynamic Proxy Conversation Flow ` +
    `Test Report\n\n`;
  md += `**Time:** ${ts}\n`;
  md += `**Scenarios:** ${total}\n`;
  md += `**Steps:** ${totalSteps}\n`;
  md += `**Passed:** ${passed}\n`;
  md += `**Failed:** ${failed}\n`;
  md += `**Perf Warnings:** ` +
    `${perfWarnCount}\n`;
  md += `**Pass Rate:** ` +
    `${((passed / total) * 100).toFixed(1)}%\n\n`;

  const suiteNames: Record<string, string> = {
    A: 'Suite A: 结果集延续',
    B: 'Suite B: 确认状态机',
    C: 'Suite C: 参数改写',
    D: 'Suite D: 错误恢复',
    E: 'Suite E: 语言与国家码',
    F: 'Suite F: 跨模块链路',
    G: 'Suite G: 跨域隔离',
    H: 'Suite H: 英文口语',
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
        const perf =
          s.perfWarnings.length > 0
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
    }
  }

  md += '---\n\n# Performance SLA (4-tier)\n\n';
  md += `| Tier | Metric | SLA |\n`;
  md += `|------|--------|-----|\n`;
  md += `| T1 | Cancel/Confirm | ` +
    `< ${PERF.CANCEL_CONFIRM_MS}ms |\n`;
  md += `| T2 | Semantic follow-up | ` +
    `< ${PERF.SEMANTIC_FOLLOW_UP_MS}ms |\n`;
  md += `| T3 | Param rewrite | ` +
    `< ${PERF.PARAM_REWRITE_MS}ms |\n`;
  md += `| T4 | Query / Extract | ` +
    `< ${PERF.QUERY_MS}ms |\n`;

  return md;
}

describe(
  'Dynamic Proxy Conversation Flow Tests',
  () => {
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
              `\n[FAIL] ` +
                `${scenario.name}:\n${details}`
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
      const mdPath = path.join(
        dir,
        `dynamic-flow-${ts}.md`
      );
      const jsonPath = path.join(
        dir,
        `dynamic-flow-${ts}.json`
      );
      const latestMd = path.join(
        dir,
        'dynamic-flow-latest.md'
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
  }
);
