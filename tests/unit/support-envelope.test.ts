import { describe, expect, it } from 'vitest';
import { ERROR_CODES, HTTP_STATUS_FOR_ERROR } from '../../src/config/constants';
import { ERROR_CATALOG, SUGGESTED_ACTIONS, listErrorCatalog } from '../../src/modules/support/error-catalog';
import { buildErrorEnvelope } from '../../src/modules/support/error-envelope';
import { matchKnownIssue, normalizeEndpoint } from '../../src/modules/support/known-issues';
import { sendError } from '../../src/utils/response';

describe('error catalog', () => {
  it('has an entry for every error code with a consistent HTTP status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      const entry = ERROR_CATALOG[code];
      expect(entry, code).toBeDefined();
      expect(entry.status).toBe(HTTP_STATUS_FOR_ERROR[code]);
      expect(SUGGESTED_ACTIONS).toContain(entry.suggested_action);
      expect(entry.agent_steps.length).toBeGreaterThan(0);
    }
    expect(listErrorCatalog().length).toBe(Object.keys(ERROR_CATALOG).length);
  });

  it('maps the money and auth codes as the proposal specifies', () => {
    const expectations: Array<[string, number, boolean, string]> = [
      ['PRICE_MISMATCH', 409, true, 'refresh_quote_and_retry'],
      ['IDEMPOTENCY_CONFLICT', 409, false, 'fix_request'],
      ['BUDGET_EXCEEDED', 402, false, 'ask_owner_to_raise_budget'],
      ['INSUFFICIENT_BALANCE', 402, false, 'ask_owner_to_top_up'],
      ['PRODUCT_NOT_FOUND', 404, false, 'fix_request'],
      ['AUTH_INVALID_KEY', 401, false, 'do_not_retry'],
      ['RATE_LIMIT_EXCEEDED', 429, true, 'wait_and_retry'],
      ['INVALID_REFERRAL_CODE', 400, false, 'fix_request'],
      ['UPSTREAM_UNAVAILABLE', 503, true, 'check_status'],
    ];
    for (const [code, status, retryable, action] of expectations) {
      const e = ERROR_CATALOG[code];
      expect([e.status, e.retryable, e.suggested_action], code).toEqual([status, retryable, action]);
    }
    expect(ERROR_CATALOG.PRICE_MISMATCH.side_effects).toEqual({ charged: false, order_created: false, session_state_changed: false });
    expect(ERROR_CATALOG.BACKEND_ERROR.side_effects.charged).toBe('unknown');
  });
});

describe('error envelope', () => {
  it('is additive: keeps code/message/details and adds machine fields', () => {
    const e = buildErrorEnvelope({
      code: 'PRICE_MISMATCH', message: 'price changed', details: { expected: 1, current: 2 }, status: 409, requestId: 'req_abc',
    });
    expect(e).toMatchObject({
      code: 'PRICE_MISMATCH',
      message: 'price changed',
      details: { expected: 1, current: 2 },
      status: 409,
      category: 'conflict',
      retryable: true,
      retry_after: null,
      suggested_action: 'refresh_quote_and_retry',
      doc_url: 'https://api.nexalayer.net/v1/public/errors/PRICE_MISMATCH',
      known_issue_id: null,
      request_id: 'req_abc',
      error_schema_version: '1',
    });
    expect(e.support).toMatchObject({ email: 'support@nexalayer.net', telegram: '@LEWISMIN' });
  });

  it('lets details override retry_after and side_effects', () => {
    const e = buildErrorEnvelope({
      code: 'RATE_LIMIT_EXCEEDED', message: 'slow down', status: 429, requestId: 'req_1',
      details: { retry_after: 12.2, side_effects: { charged: false } },
    });
    expect(e.retry_after).toBe(13);
    expect(e.details).toEqual({ retry_after: 12.2 });
  });

  it('only links endpoint-scoped known issues on that endpoint', () => {
    expect(buildErrorEnvelope({ code: 'BACKEND_ERROR', message: 'x', status: 502, requestId: 'req_1' }).known_issue_id).toBeNull();
    expect(buildErrorEnvelope({
      code: 'BACKEND_ERROR', message: 'x', status: 502, requestId: 'req_1', endpoint: 'DELETE /v1/sessions/:session_id',
    }).known_issue_id).toBe('KI-2026-001');
    expect(normalizeEndpoint('DELETE /v1/sessions/:session_id')).toBe(normalizeEndpoint('DELETE /v1/sessions/{id}'));
    expect(matchKnownIssue(['BACKEND_ERROR'])?.id).toBe('KI-2026-001');
    expect(matchKnownIssue(['PRICE_MISMATCH'])).toBeNull();
  });

  it('sendError uses the request id, sets Retry-After, and records the code', () => {
    const headers: Record<string, string> = {};
    const request: Record<string, unknown> = { id: 'req_0123456789abcdef', method: 'GET', routeOptions: { url: '/v1/x' } };
    let sent: any;
    let statusCode = 0;
    const reply: any = {
      request,
      header: (k: string, v: string) => { headers[k.toLowerCase()] = v; return reply; },
      getHeader: (k: string) => headers[k.toLowerCase()],
      status: (s: number) => { statusCode = s; return reply; },
      send: (b: unknown) => { sent = b; return reply; },
    };
    sendError(reply, 'UPSTREAM_UNAVAILABLE', 'down');
    expect(statusCode).toBe(503);
    expect(headers['retry-after']).toBe('60');
    expect(sent.meta.request_id).toBe('req_0123456789abcdef');
    expect(sent.error.request_id).toBe('req_0123456789abcdef');
    expect(request.errorCode).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('still works with minimal reply mocks (no request)', () => {
    let sent: any;
    const reply: any = { status: () => reply, send: (b: unknown) => { sent = b; return reply; } };
    sendError(reply, 'PRODUCT_NOT_FOUND', 'nope');
    expect(sent.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(sent.meta.request_id).toMatch(/^req_[0-9a-f]{16}$/);
  });
});
