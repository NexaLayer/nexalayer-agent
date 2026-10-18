import { describe, expect, it } from 'vitest';
import { triageTicket, type TriageInput } from '../../src/modules/support/triage';
import { canTransition, TICKET_STATES, ticketStateMachine } from '../../src/modules/support/ticket-state';
import { redactDeep, redactString } from '../../src/modules/support/redact';
import { buildSla, firstResponseBy } from '../../src/modules/support/sla';
import { KNOWN_ISSUES } from '../../src/modules/support/known-issues';

const base: TriageInput = {
  category: 'bug', error_codes: [], summary: 'x', credential_leak_detected: false,
  degraded_components: [], known_issue: null, observed_statuses: [],
};

describe('triage', () => {
  it('security and credential leaks go to the founder as S1', () => {
    expect(triageTicket({ ...base, category: 'security' })).toMatchObject({ class: 'security', severity: 'S1', assignee_role: 'founder' });
    expect(triageTicket({ ...base, credential_leak_detected: true })).toMatchObject({ class: 'security', severity: 'S1' });
  });

  it('outage during a degraded component is S1; with a known workaround S3', () => {
    expect(triageTicket({ ...base, error_codes: ['UPSTREAM_UNAVAILABLE'], degraded_components: ['sessions'] }))
      .toMatchObject({ class: 'outage', severity: 'S1' });
    expect(triageTicket({ ...base, category: 'outage', known_issue: KNOWN_ISSUES[0] }))
      .toMatchObject({ class: 'outage', severity: 'S3', workaround_available: true });
  });

  it('wrong billing is S1 and needs the founder; a billing question is S3', () => {
    expect(triageTicket({ ...base, category: 'refund_request' })).toMatchObject({ class: 'billing', severity: 'S1', needs_founder: true });
    expect(triageTicket({ ...base, category: 'billing', summary: 'I was double charged' })).toMatchObject({ severity: 'S1' });
    expect(triageTicket({ ...base, category: 'billing', summary: 'where is my invoice' })).toMatchObject({ severity: 'S3', needs_founder: false });
  });

  it('owner-action and usage errors are S4 auto-replies', () => {
    expect(triageTicket({ ...base, error_codes: ['BUDGET_EXCEEDED'] })).toMatchObject({ class: 'owner_action', severity: 'S4' });
    expect(triageTicket({ ...base, error_codes: ['PRICE_MISMATCH', 'PRODUCT_NOT_FOUND'] })).toMatchObject({ class: 'usage_error', severity: 'S4' });
  });

  it('bugs: S2 without a workaround, S3 with one', () => {
    expect(triageTicket({ ...base, error_codes: ['INTERNAL_ERROR'] })).toMatchObject({ class: 'bug', severity: 'S2', route: 'open_github_issue' });
    expect(triageTicket({ ...base, error_codes: ['BACKEND_ERROR'], known_issue: KNOWN_ISSUES[0] })).toMatchObject({ class: 'bug', severity: 'S3' });
  });

  it('sales, features, abuse and questions route correctly', () => {
    expect(triageTicket({ ...base, category: 'sales_pricing' })).toMatchObject({ class: 'sales', assignee_role: 'sales_bot', severity: 'S4' });
    expect(triageTicket({ ...base, category: 'usage_question', summary: 'enterprise volume pricing?' })).toMatchObject({ class: 'sales' });
    expect(triageTicket({ ...base, category: 'feature_request' })).toMatchObject({ class: 'feature', severity: 'S4' });
    expect(triageTicket({ ...base, category: 'abuse_report' })).toMatchObject({ class: 'abuse', assignee_role: 'founder' });
    expect(triageTicket({ ...base, category: 'usage_question' })).toMatchObject({ class: 'question', severity: 'S4' });
  });
});

describe('ticket state machine', () => {
  it('has the 8 states including awaiting_approval', () => {
    expect(TICKET_STATES).toEqual(['received', 'triaged', 'needs_info', 'in_progress', 'awaiting_approval', 'workaround_available', 'resolved', 'closed']);
    expect(ticketStateMachine().transitions.length).toBe(14);
  });

  it('enforces actors and transitions', () => {
    expect(canTransition('in_progress', 'awaiting_approval', 'product_bot')).toBe(true);
    expect(canTransition('awaiting_approval', 'in_progress', 'product_bot')).toBe(false);
    expect(canTransition('awaiting_approval', 'in_progress', 'founder')).toBe(true);
    expect(canTransition('awaiting_approval', 'resolved', 'founder')).toBe(false);
    expect(canTransition('closed', 'in_progress', 'founder')).toBe(false);
    expect(canTransition('resolved', 'in_progress', 'reporter')).toBe(true);
  });
});

describe('redaction', () => {
  it('removes proxy URLs, keys, tokens and password fields', () => {
    const input = {
      summary: 'proxy socks5://alice:hunter2@1.2.3.4:1080 failed, key ak_0123456789abcdef0123456789abcdef and password=hunter2',
      reproduction: { params_redacted: { full_url: 'socks5://a:b@c:1', password: 'p', country: 'US' } },
      note: 'Authorization: Bearer abcdefghijklmnop.qrs',
      line: 'host1.example.net:6666:user_x:pw_y',
    };
    const { value, count } = redactDeep(input);
    const text = JSON.stringify(value);
    for (const secret of ['hunter2', 'alice', 'ak_0123', 'abcdefghijklmnop', 'pw_y', 'socks5://a:b']) {
      expect(text).not.toContain(secret);
    }
    expect(value.reproduction.params_redacted.country).toBe('US');
    expect(count).toBeGreaterThanOrEqual(6);
    expect(redactString('nothing secret here').count).toBe(0);
  });
});

describe('SLA', () => {
  it('publishes early-access targets, not guarantees', () => {
    const sla = buildSla();
    expect(sla.kind).toBe('early_access_response_targets');
    expect(sla.disclaimer).toMatch(/not guarantees/i);
    expect(sla.response_targets.map((t) => [t.severity, t.target])).toEqual([
      ['S1', 'PT4H'], ['S2', 'PT24H'], ['S3', 'P3BD'], ['S4', 'best_effort'],
    ]);
    expect(sla.contact.email).toBe('support@nexalayer.net');
  });

  it('computes first-response targets (3 business days skips weekends)', () => {
    const fri = new Date('2026-10-16T10:00:00Z');
    expect(firstResponseBy('S1', fri)?.toISOString()).toBe('2026-10-16T14:00:00.000Z');
    expect(firstResponseBy('S2', fri)?.toISOString()).toBe('2026-10-17T10:00:00.000Z');
    expect(firstResponseBy('S3', fri)?.toISOString()).toBe('2026-10-21T10:00:00.000Z');
    expect(firstResponseBy('S4', fri)).toBeNull();
  });
});
