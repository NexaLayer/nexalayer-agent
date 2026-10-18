#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  CREDENTIALS_NOTE,
  getSessionApiPath,
  rotateSessionApiPath,
} from './session-request.js';
import {
  buildTicketBody,
  NexaLayerApiError,
  parseApiError,
  RequestRing,
  toolErrorResult,
} from './support.js';

export const MCP_VERSION = '0.2.0';
const ring = new RequestRing(20);

const baseUrl = (process.env.NEXALAYER_BASE_URL ?? 'https://api.nexalayer.net/v1').replace(/\/$/, '');

async function api(method: string, path: string, body?: unknown, idempotencyKey?: string, options: { auth?: boolean } = {}) {
  const auth = options.auth ?? true;
  const apiKey = process.env.NEXALAYER_API_KEY;
  if (auth && !apiKey) {
    throw new Error(
      'NEXALAYER_API_KEY is not set. Get one at https://www.nexalayer.net'
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(auth && apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const headerRequestId = response.headers.get('x-request-id');
  if (!response.ok) {
    const parsed = parseApiError(response.status, text);
    const requestId = parsed.requestId ?? headerRequestId;
    if (requestId) {
      ring.record({ request_id: requestId, error_code: parsed.error.code ?? null, status: response.status, at: new Date().toISOString() });
    }
    throw new NexaLayerApiError(response.status, parsed.error, requestId);
  }
  const json = text ? JSON.parse(text) : {};
  const requestId = (json as { meta?: { request_id?: string } })?.meta?.request_id ?? headerRequestId;
  if (requestId) ring.record({ request_id: requestId, error_code: null, status: response.status, at: new Date().toISOString() });
  return json;
}

const result = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

type Product = Record<string, unknown>;

function productItems(response: unknown): Product[] {
  if (!response || typeof response !== 'object') return [];
  const body = response as Record<string, unknown>;
  const data = body.data && typeof body.data === 'object'
    ? body.data as Record<string, unknown>
    : body;
  return Array.isArray(data.items)
    ? data.items.filter((item): item is Product => Boolean(item) && typeof item === 'object')
    : [];
}

function compactProduct(product: Product) {
  const fields = [
    'product_no', 'name', 'type', 'sharing', 'available', 'price', 'currency', 'unit',
    'stock', 'country', 'city', 'project_required',
  ] as const;
  const compact: Product = {};
  for (const field of fields) {
    if (product[field] !== undefined && product[field] !== null) {
      compact[field] = product[field];
    }
  }
  if (Array.isArray(product.projects)) compact.project_count = product.projects.length;
  return compact;
}

const server = new McpServer({ name: 'nexalayer', version: MCP_VERSION });

// Every API failure becomes an MCP tool error (isError: true) with the full
// NexaLayer error envelope in structuredContent, so the model can branch on
// code / retryable / suggested_action instead of parsing prose.
const originalTool = server.tool.bind(server) as (...args: unknown[]) => unknown;
(server as unknown as { tool: (...args: unknown[]) => unknown }).tool = (...args: unknown[]) => {
  const handler = args[args.length - 1];
  if (typeof handler === 'function') {
    args[args.length - 1] = async (...callArgs: unknown[]) => {
      try {
        return await (handler as (...a: unknown[]) => unknown)(...callArgs);
      } catch (err) {
        return toolErrorResult(err);
      }
    };
  }
  return originalTool(...args);
};

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const paidWrite = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;
const policyWrite = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;
const destructiveWrite = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

server.tool('nexalayer_list_products', 'List a compact catalog of current products and prices before purchasing.', {
  type: z.enum(['all', 'dynamic', 'static']).default('all'),
  country: z.string().optional(),
  in_stock: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
}, readOnly, async ({ type, country, in_stock, limit, cursor }) => {
  const query = new URLSearchParams({ type, in_stock: String(in_stock), limit: String(limit) });
  if (country) query.set('country', country);
  if (cursor) query.set('cursor', cursor);
  const response = await api('GET', `/products?${query}`);
  const products = productItems(response).map(compactProduct);
  const data = response && typeof response === 'object'
    ? (response as Record<string, unknown>).data as Record<string, unknown> | undefined
    : undefined;
  return result({
    items: products,
    next_cursor: data?.next_cursor ?? null,
    total: data?.total ?? products.length,
  });
});

server.tool('nexalayer_create_session', `Create a paid network session. This action incurs charges against the account balance. Configure a budget first and obtain owner approval for autonomous spend. The create API does not honor include_credentials and omits proxy credentials; read the session with include_credentials=true. ${CREDENTIALS_NOTE} PRICE_MISMATCH (409: re-read prices, retry once). BUDGET_EXCEEDED and INSUFFICIENT_BALANCE (402: ask the owner, don't retry).`, {
  session_type: z.enum(['dynamic', 'static']),
  product_no: z.string(),
  protocol: z.enum(['socks5', 'http']).default('socks5'),
  quantity: z.number().int().positive().default(1),
  country_code: z.string().optional(),
  duration: z.number().int().positive().optional(),
  idempotency_key: z.string().min(1).max(64),
}, paidWrite, async ({ idempotency_key, ...body }) => result(await api('POST', '/sessions', body, idempotency_key)));

server.tool('nexalayer_get_session', `Read one session's status and proxy endpoint. ${CREDENTIALS_NOTE}`, {
  session_id: z.string(),
  include_credentials: z.boolean().default(false),
}, readOnly, async ({ session_id, include_credentials }) => result(await api('GET', getSessionApiPath(session_id, include_credentials))));

server.tool('nexalayer_rotate_session', `Rotate a dynamic session after health or telemetry recommends rotation. ${CREDENTIALS_NOTE}`, {
  session_id: z.string(),
  reason: z.string().optional(),
  include_credentials: z.boolean().default(false),
  idempotency_key: z.string().min(1).max(64),
}, paidWrite, async ({ session_id, reason, include_credentials, idempotency_key }) => result(await api('POST', rotateSessionApiPath(session_id, include_credentials), { reason }, idempotency_key)));

server.tool('nexalayer_terminate_session', 'Terminate a session and release its underlying network resource. Early termination does not imply a refund.', {
  session_id: z.string(),
}, destructiveWrite, async ({ session_id }) => result(await api('DELETE', `/sessions/${encodeURIComponent(session_id)}`)));

server.tool('nexalayer_session_health', 'Read health score and rotation recommendation for a session.', {
  session_id: z.string(),
}, readOnly, async ({ session_id }) => result(await api('GET', `/sessions/${encodeURIComponent(session_id)}/health`)));

server.tool('nexalayer_session_usage', 'Read traffic and request usage for a session.', {
  session_id: z.string(),
}, readOnly, async ({ session_id }) => result(await api('GET', `/sessions/${encodeURIComponent(session_id)}/usage`)));

server.tool('nexalayer_get_budget', 'Read spend limits, current spend, pause state, and next daily reset.', {}, readOnly,
  async () => result(await api('GET', '/account/budget')));

server.tool('nexalayer_set_budget', 'Set key and daily spend limits. This is a consequential write and should require owner approval.', {
  key_limit_usd: z.number().positive().nullable().optional(),
  daily_limit_usd: z.number().positive().nullable().optional(),
  pause_on_exceed: z.boolean().default(true),
  alert_thresholds: z.array(z.number().int().min(1).max(100)).default([50, 80, 100]),
  paused: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(64),
}, policyWrite, async ({ idempotency_key, ...body }) => result(await api('PUT', '/account/budget', body, idempotency_key)));

server.tool('nexalayer_usage_alerts', 'Read actionable budget threshold alerts.', {}, readOnly,
  async () => result(await api('GET', '/account/usage-alerts')));

server.tool('nexalayer_get_balance', 'Read the current account balance and trial-credit state.', {}, readOnly,
  async () => result(await api('GET', '/billing/balance')));

server.tool('nexalayer_list_transactions', 'List billing transactions for audit and reconciliation.', {
  page: z.number().int().positive().default(1),
  page_size: z.number().int().min(1).max(100).default(20),
}, readOnly, async ({ page, page_size }) => {
  const query = new URLSearchParams({ page: String(page), page_size: String(page_size) });
  return result(await api('GET', `/billing/transactions?${query}`));
});

// ---------------------------------------------------------------------------
// Support tools (no charge). Use these when an error is not self-explanatory.

server.tool('nexalayer_check_status', 'Check NexaLayer service status before retrying or filing a ticket. Returns each component (api, sessions, billing, catalog, upstream_network) as operational, degraded_performance, partial_outage, major_outage, or under_maintenance, plus active incidents and recent incident history. If the component your call depends on is not operational, wait and retry later instead of reporting an issue. No API key needed; no charge.', {}, readOnly,
  async () => result(await api('GET', '/public/status', undefined, undefined, { auth: false })));

server.tool('nexalayer_known_issues', 'List known issues with machine-runnable workaround steps. Call this with the error_code from a failed tool call (for example UPSTREAM_UNAVAILABLE or BACKEND_ERROR) before filing a ticket; if an issue matches, run its workaround.steps instead of reporting. No API key needed; no charge.', {
  error_code: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  component: z.string().optional(),
  status: z.enum(['open', 'investigating', 'identified', 'monitoring', 'workaround_available', 'resolved']).default('open'),
}, readOnly, async ({ error_code, component, status }) => {
  const query = new URLSearchParams({ status });
  if (error_code) query.set('error_code', error_code);
  if (component) query.set('component', component);
  return result(await api('GET', `/public/known-issues?${query}`, undefined, undefined, { auth: false }));
});

server.tool('nexalayer_report_issue', 'File a support ticket with NexaLayer. Use only after following the error\'s suggested_action and checking nexalayer_check_status and nexalayer_known_issues. Recent request_ids and error codes seen by this MCP server are attached automatically, so you do not need to copy them. The server assigns severity (S1 outage or wrong billing, S2 broken with no workaround, S3 bug with a workaround, S4 question or feature request). Returns ticket_id and next_check_after_seconds; poll with nexalayer_get_ticket. Never include API keys, proxy passwords, or full_url: they are redacted and the ticket is escalated as a security issue. No charge.', {
  category: z.enum(['usage_question', 'bug', 'outage', 'billing', 'refund_request', 'feature_request', 'sales_pricing', 'abuse_report', 'security']),
  summary: z.string().min(1).max(200),
  severity_claimed: z.enum(['S1', 'S2', 'S3', 'S4']).optional(),
  session_id: z.string().max(50).optional(),
  error_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).max(10).optional(),
  request_ids: z.array(z.string().regex(/^req_[A-Za-z0-9]+$/)).max(20).optional(),
  known_issue_id: z.string().max(40).optional(),
  tool: z.string().max(200).optional().describe('The NexaLayer tool that failed, e.g. nexalayer_terminate_session'),
  expected: z.string().max(1000).optional(),
  actual: z.string().max(1000).optional(),
  desired_outcome: z.enum(['fix', 'workaround', 'refund_review', 'explanation', 'feature']).optional(),
  idempotency_key: z.string().min(1).max(64).optional().describe('Reuse the same key when retrying so only one ticket is filed'),
}, { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async (args) => {
  const clientInfo = server.server.getClientVersion();
  const body = buildTicketBody(args, ring, {
    version: MCP_VERSION,
    mcpClient: clientInfo ? `${clientInfo.name}@${clientInfo.version}` : undefined,
  });
  return result(await api('POST', '/support/tickets', body, args.idempotency_key));
});

server.tool('nexalayer_get_ticket', 'Read a NexaLayer support ticket: status (received, triaged, needs_info, in_progress, awaiting_approval, workaround_available, resolved, closed), severity, events, matched known issue with workaround steps, and resolution. Poll no sooner than next_check_after_seconds. No charge.', {
  ticket_id: z.string().regex(/^tkt_[A-Za-z0-9]+$/),
}, readOnly, async ({ ticket_id }) => result(await api('GET', `/support/tickets/${encodeURIComponent(ticket_id)}`)));

await server.connect(new StdioServerTransport());
