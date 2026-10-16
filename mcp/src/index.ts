#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const baseUrl = (process.env.NEXALAYER_BASE_URL ?? 'https://api.nexalayer.net/v1').replace(/\/$/, '');

async function api(method: string, path: string, body?: unknown, idempotencyKey?: string) {
  const apiKey = process.env.NEXALAYER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'NEXALAYER_API_KEY is not set. Get one at https://www.nexalayer.net'
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`NexaLayer API ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
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

const server = new McpServer({ name: 'nexalayer', version: '0.1.5' });

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

server.tool('nexalayer_create_session', 'Create a paid network session. This action incurs charges against the account balance. Configure a budget first and obtain owner approval for autonomous spend.', {
  session_type: z.enum(['dynamic', 'static']),
  product_no: z.string(),
  protocol: z.enum(['socks5', 'http']).default('socks5'),
  quantity: z.number().int().positive().default(1),
  country_code: z.string().optional(),
  duration: z.number().int().positive().optional(),
  idempotency_key: z.string().min(1).max(64),
}, paidWrite, async ({ idempotency_key, ...body }) => result(await api('POST', '/sessions', body, idempotency_key)));

server.tool('nexalayer_rotate_session', 'Rotate a dynamic session after health or telemetry recommends rotation.', {
  session_id: z.string(),
  reason: z.string().optional(),
  idempotency_key: z.string().min(1).max(64),
}, paidWrite, async ({ session_id, reason, idempotency_key }) => result(await api('POST', `/sessions/${encodeURIComponent(session_id)}/rotate`, { reason }, idempotency_key)));

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

await server.connect(new StdioServerTransport());
