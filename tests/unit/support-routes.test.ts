import Fastify, { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as any, alerts: [] as any[] }));

vi.mock('../../src/app', async () => {
  const { createFakePrisma } = await import('./helpers/fake-prisma');
  h.fake = createFakePrisma();
  return { prisma: h.fake.prisma };
});
vi.mock('../../src/config/env', () => ({
  env: {
    OPS_ADMIN_TOKEN: 'admin-token-admin-token-admin-token-0000',
    OPS_ALERT_DEDUPE_MINUTES: 30,
    STATUS_CHECK_INTERVAL_SECONDS: 60,
    BACKEND_BASE_URL: 'http://127.0.0.1:9',
  },
}));
vi.mock('../../src/modules/ops/ops-alert.service', () => ({
  OPS_ALERT_EVENTS: {
    SUPPORT_TICKET_URGENT: 'SUPPORT_TICKET_URGENT',
    COMPONENT_STATUS_CHANGED: 'COMPONENT_STATUS_CHANGED',
  },
  sendOpsAlert: vi.fn(async (...args: unknown[]) => { h.alerts.push(args); return { deduped: false, channels: [], failures: [] }; }),
}));

const KEY = 'ak_routes_test_key_000000000000000000000000';
const OTHER_KEY = 'ak_routes_other_key_00000000000000000000000';
const ADMIN = 'Bearer admin-token-admin-token-admin-token-0000';
let app: FastifyInstance;

async function build() {
  const { newRequestId } = await import('../../src/utils/response');
  const { registerErrorHandler } = await import('../../src/middleware/error-handler');
  const { registerIdempotencyPersistence } = await import('../../src/middleware/idempotency');
  const routes = await import('../../src/modules/support/support.routes');
  const instance = Fastify({ genReqId: () => newRequestId() });
  registerErrorHandler(instance);
  registerIdempotencyPersistence(instance);
  instance.addHook('onResponse', async (request, reply) => {
    // Mirror the production API log hook (request_id + error_code).
    await h.fake.prisma.agentApiLog.create({
      data: {
        agentId: request.agentContext?.agentId,
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        requestId: request.id,
        errorCode: request.errorCode,
      },
    });
  });
  await instance.register(routes.publicSupportRoutes, { prefix: '/v1/public' });
  await instance.register(routes.supportTicketRoutes, { prefix: '/v1/support' });
  await instance.register(routes.supportAdminRoutes, { prefix: '/v1/admin' });
  return instance;
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload: body as any, headers: { 'x-api-key': KEY, ...headers } });

beforeAll(async () => {
  app = await build();
  h.fake.db.agentApp.push(
    { id: 1, apiKey: KEY, status: 'active', permissions: [] },
    { id: 2, apiKey: OTHER_KEY, status: 'active', permissions: [] },
  );
  h.fake.db.agentSession.push({ sessionId: 'ses_mine', agentId: 1 }, { sessionId: 'ses_theirs', agentId: 2 });
});
afterAll(async () => { await app.close(); });
beforeEach(() => {
  h.fake.db.supportTicket.length = 0;
  h.fake.db.supportTicketEvent.length = 0;
  h.fake.db.agentIdempotencyKey.length = 0;
  h.alerts.length = 0;
});

describe('public support endpoints (no auth)', () => {
  it('GET /v1/public/status returns components, incidents and cache headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/public/status' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30');
    const body = res.json();
    expect(body.data.indicator).toBe('none');
    expect(body.data.components.map((c: any) => c.id)).toEqual(['api', 'sessions', 'billing', 'catalog', 'upstream_network']);
    expect(body.data).toHaveProperty('incident_history');
    expect(body.meta.request_id).toMatch(/^req_/);
  });

  it('GET /v1/public/errors and /errors/:code', async () => {
    const list = (await app.inject({ method: 'GET', url: '/v1/public/errors' })).json();
    expect(list.data.items.some((e: any) => e.code === 'PRICE_MISMATCH')).toBe(true);
    expect(list.data.self_serve_procedure).toContain('POST /v1/support/tickets');
    const one = (await app.inject({ method: 'GET', url: '/v1/public/errors/budget_exceeded' })).json();
    expect(one.data).toMatchObject({ code: 'BUDGET_EXCEEDED', status: 402, suggested_action: 'ask_owner_to_raise_budget' });
    const missing = await app.inject({ method: 'GET', url: '/v1/public/errors/NOPE' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('ERROR_CODE_NOT_FOUND');
  });

  it('GET /v1/public/known-issues filters and /sla publishes targets', async () => {
    const ki = (await app.inject({ method: 'GET', url: '/v1/public/known-issues?error_code=UPSTREAM_UNAVAILABLE' })).json();
    expect(ki.data.items[0].id).toBe('KI-2026-001');
    const none = (await app.inject({ method: 'GET', url: '/v1/public/known-issues?error_code=PRICE_MISMATCH' })).json();
    expect(none.data.total).toBe(0);
    const sla = (await app.inject({ method: 'GET', url: '/v1/public/sla' })).json();
    expect(sla.data.disclaimer).toMatch(/not guarantees/i);
    const states = (await app.inject({ method: 'GET', url: '/v1/public/support/ticket-states' })).json();
    expect(states.data.states).toContain('awaiting_approval');
  });
});

describe('support tickets', () => {
  it('requires an API key with a structured error envelope', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/support/tickets', payload: { category: 'bug', summary: 'x' } });
    expect(res.statusCode).toBe(401);
    const err = res.json().error;
    expect(err).toMatchObject({ code: 'AUTH_INVALID_KEY', suggested_action: 'do_not_retry', retryable: false });
    expect(err.support.email).toBe('support@nexalayer.net');
    expect(err.request_id).toBe(res.json().meta.request_id);
  });

  it('rejects unknown fields (additionalProperties: false)', async () => {
    const res = await post('/v1/support/tickets', { category: 'bug', summary: 'x', evil: true });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
  });

  it('creates, triages, auto-attaches own request ids, and scopes reads', async () => {
    // A failing request on this account, plus one on another account.
    h.fake.db.agentApiLog.push(
      { agentId: 1, path: '/v1/sessions', statusCode: 409, requestId: 'req_mine1', errorCode: 'PRICE_MISMATCH', createdAt: new Date() },
      { agentId: 2, path: '/v1/sessions', statusCode: 500, requestId: 'req_theirs1', errorCode: 'INTERNAL_ERROR', createdAt: new Date() },
    );
    const res = await post('/v1/support/tickets', {
      category: 'usage_question',
      summary: 'price changed during purchase',
      request_ids: ['req_theirs1'],
      session_id: 'ses_theirs',
    });
    expect(res.statusCode).toBe(201);
    const t = res.json().data;
    expect(t).toMatchObject({ status: 'triaged', severity: 'S4', triage_class: 'usage_error', deduplicated: false, session_id: null });
    expect(t.request_ids).toEqual(['req_mine1']);
    expect(t.auto_attached_error_codes).toEqual(['PRICE_MISMATCH']);
    expect(t.dropped_request_ids).toBe(1);
    expect(t.events.map((e: any) => e.to)).toEqual(['received', 'triaged']);
    expect(t.response_target.kind).toBe('early_access_target_not_guarantee');

    const own = await app.inject({ method: 'GET', url: `/v1/support/tickets/${t.ticket_id}`, headers: { 'x-api-key': KEY } });
    expect(own.statusCode).toBe(200);
    const foreign = await app.inject({ method: 'GET', url: `/v1/support/tickets/${t.ticket_id}`, headers: { 'x-api-key': OTHER_KEY } });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('TICKET_NOT_FOUND');
  });

  it('never stores or echoes proxy credentials and escalates leaks', async () => {
    const res = await post('/v1/support/tickets', {
      category: 'bug',
      summary: 'proxy socks5://bob:s3cret@10.0.0.1:1080 times out',
      reproduction: { params_redacted: { full_url: 'socks5://bob:s3cret@10.0.0.1:1080', password: 's3cret' } },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).not.toContain('s3cret');
    expect(JSON.stringify(h.fake.db.supportTicket)).not.toContain('s3cret');
    const t = res.json().data;
    expect(t.redactions_applied).toBeGreaterThanOrEqual(3);
    expect(t).toMatchObject({ severity: 'S1', triage_class: 'security', assignee_role: 'founder' });
    expect(h.alerts.some(([event]) => event === 'SUPPORT_TICKET_URGENT')).toBe(true);
  });

  it('S3/S4 tickets do not page the owner; S2 does', async () => {
    await post('/v1/support/tickets', { category: 'feature_request', summary: 'webhooks' });
    expect(h.alerts).toHaveLength(0);
    await post('/v1/support/tickets', { category: 'bug', summary: 'rotate returns 500', error_codes: ['INTERNAL_ERROR'] });
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0][1]).toBe('warning');
  });

  it('supports Idempotency-Key header replay and body idempotency_key', async () => {
    const body = { category: 'feature_request', summary: 'more countries' };
    const a = await post('/v1/support/tickets', body, { 'idempotency-key': 'idem-a' });
    const b = await post('/v1/support/tickets', body, { 'idempotency-key': 'idem-a' });
    expect(b.headers['x-idempotent-replay']).toBe('true');
    expect(b.json().data.ticket_id).toBe(a.json().data.ticket_id);
    const c = await post('/v1/support/tickets', { ...body, summary: 'different' }, { 'idempotency-key': 'idem-a' });
    expect(c.statusCode).toBe(409);
    expect(c.json().error.code).toBe('IDEMPOTENCY_CONFLICT');

    const d = await post('/v1/support/tickets', { category: 'bug', summary: 'x', idempotency_key: 'body-1' });
    const e = await post('/v1/support/tickets', { category: 'bug', summary: 'x', idempotency_key: 'body-1' });
    expect([d.statusCode, e.statusCode]).toEqual([201, 200]);
    expect(e.json().data.deduplicated).toBe(true);
  });

  it('deduplicates repeated reports and rate-limits per key', async () => {
    const first = await post('/v1/support/tickets', { category: 'bug', summary: 'a', error_codes: ['PRODUCT_NOT_FOUND'], session_id: 'ses_mine' });
    const again = await post('/v1/support/tickets', { category: 'bug', summary: 'a again', error_codes: ['PRODUCT_NOT_FOUND'], session_id: 'ses_mine' });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json().data).toMatchObject({ deduplicated: true, duplicate_count: 1, ticket_id: first.json().data.ticket_id });

    for (const code of ['A_ONE', 'A_TWO', 'A_THREE', 'A_FOUR']) {
      await post('/v1/support/tickets', { category: 'bug', summary: code, error_codes: [code] });
    }
    const limited = await post('/v1/support/tickets', { category: 'bug', summary: 'sixth', error_codes: ['A_SIX'] });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBe('600');
    expect(limited.json().error).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', retry_after: 600, suggested_action: 'wait_and_retry' });
  });
});

describe('admin path', () => {
  it('is protected by the admin bearer token', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/admin/status/components/api', payload: { status: 'degraded_performance' } });
    expect(res.statusCode).toBe(403);
  });

  it('marks components degraded/outage, records incidents, and alerts on change', async () => {
    const set = (status: string) => app.inject({
      method: 'POST', url: '/v1/admin/status/components/sessions', headers: { authorization: ADMIN }, payload: { status, reason: 'test' },
    });
    expect((await set('partial_outage')).json().data).toMatchObject({ changed: true, from: 'operational', to: 'partial_outage' });
    let status = (await app.inject({ method: 'GET', url: '/v1/public/status' })).json().data;
    expect(status.indicator).toBe('major');
    expect(status.active_incidents).toHaveLength(1);
    await set('operational');
    status = (await app.inject({ method: 'GET', url: '/v1/public/status' })).json().data;
    expect(status.active_incidents).toHaveLength(0);
    expect(status.incident_history[0].status).toBe('resolved');
    expect(h.alerts.filter(([e]) => e === 'COMPONENT_STATUS_CHANGED')).toHaveLength(2);
  });

  it('moves tickets through the state machine including awaiting_approval', async () => {
    const t = (await post('/v1/support/tickets', { category: 'refund_request', summary: 'charged but no proxy' })).json().data;
    const move = (to: string, actor = 'product_bot') => app.inject({
      method: 'POST', url: `/v1/admin/support/tickets/${t.ticket_id}/transition`, headers: { authorization: ADMIN }, payload: { to, actor, reason: 'test' },
    });
    expect((await move('in_progress')).json().data.status).toBe('in_progress');
    expect((await move('awaiting_approval')).json().data.status).toBe('awaiting_approval');
    const blocked = await move('in_progress');
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('INVALID_STATE_TRANSITION');
    expect((await move('in_progress', 'founder')).json().data.status).toBe('in_progress');
  });
});
