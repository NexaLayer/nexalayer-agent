#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const apiKey = process.env.NEXALAYER_API_KEY;
const baseUrl = (process.env.NEXALAYER_BASE_URL ?? 'https://api.nexalayer.net/v1').replace(/\/$/, '');

if (!apiKey) {
  process.stderr.write('NEXALAYER_API_KEY is required\n');
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': apiKey!,
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

const server = new McpServer({ name: 'nexalayer', version: '0.1.0' });

server.tool('nexalayer_list_products', 'List current products and prices before purchasing.', {
  type: z.enum(['all', 'dynamic', 'static']).default('all'),
  country_code: z.string().optional(),
}, async ({ type, country_code }) => {
  const query = new URLSearchParams({ type });
  if (country_code) query.set('country_code', country_code);
  return result(await api('GET', `/products?${query}`));
});

server.tool('nexalayer_create_session', 'Create a paid network session. Configure a budget first and obtain owner approval for autonomous spend.', {
  session_type: z.enum(['dynamic', 'static']),
  product_no: z.string(),
  protocol: z.enum(['socks5', 'http']).default('socks5'),
  quantity: z.number().int().positive().default(1),
  country_code: z.string().optional(),
  duration: z.number().int().positive().optional(),
  idempotency_key: z.string().min(1).max(64),
}, async ({ idempotency_key, ...body }) => result(await api('POST', '/sessions', body, idempotency_key)));

server.tool('nexalayer_rotate_session', 'Rotate a dynamic session after health or telemetry recommends rotation.', {
  session_id: z.string(),
  reason: z.string().optional(),
  idempotency_key: z.string().min(1).max(64),
}, async ({ session_id, reason, idempotency_key }) => result(await api('POST', `/sessions/${encodeURIComponent(session_id)}/rotate`, { reason }, idempotency_key)));

server.tool('nexalayer_session_health', 'Read health score and rotation recommendation for a session.', {
  session_id: z.string(),
}, async ({ session_id }) => result(await api('GET', `/sessions/${encodeURIComponent(session_id)}/health`)));

server.tool('nexalayer_session_usage', 'Read traffic and request usage for a session.', {
  session_id: z.string(),
}, async ({ session_id }) => result(await api('GET', `/sessions/${encodeURIComponent(session_id)}/usage`)));

server.tool('nexalayer_get_budget', 'Read spend limits, current spend, pause state, and next daily reset.', {},
  async () => result(await api('GET', '/account/budget')));

server.tool('nexalayer_set_budget', 'Set key and daily spend limits. This is a consequential write and should require owner approval.', {
  key_limit_usd: z.number().positive().nullable().optional(),
  daily_limit_usd: z.number().positive().nullable().optional(),
  pause_on_exceed: z.boolean().default(true),
  alert_thresholds: z.array(z.number().int().min(1).max(100)).default([50, 80, 100]),
  paused: z.boolean().optional(),
  idempotency_key: z.string().min(1).max(64),
}, async ({ idempotency_key, ...body }) => result(await api('PUT', '/account/budget', body, idempotency_key)));

server.tool('nexalayer_usage_alerts', 'Read actionable budget threshold alerts.', {},
  async () => result(await api('GET', '/account/usage-alerts')));

await server.connect(new StdioServerTransport());
