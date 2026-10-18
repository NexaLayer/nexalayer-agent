import { getCatalogEntry } from './error-catalog';
import type { KnownIssue } from './known-issues';
import type { Severity } from './sla';

export const TICKET_CATEGORIES = [
  'usage_question', 'bug', 'outage', 'billing', 'refund_request',
  'feature_request', 'sales_pricing', 'abuse_report', 'security',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type TriageClass =
  | 'security' | 'outage' | 'billing' | 'owner_action' | 'usage_error'
  | 'bug' | 'sales' | 'feature' | 'abuse' | 'question';

export type AssigneeRole = 'product_bot' | 'founder' | 'sales_bot';

export type TriageInput = {
  category: TicketCategory;
  severity_claimed?: Severity;
  error_codes: string[];
  summary: string;
  credential_leak_detected: boolean;
  /** Components currently not operational (from /v1/public/status). */
  degraded_components: string[];
  known_issue: KnownIssue | null;
  /** HTTP statuses seen on the attached request ids (from our own logs). */
  observed_statuses: number[];
};

export type TriageResult = {
  class: TriageClass;
  severity: Severity;
  assignee_role: AssigneeRole;
  route: string;
  rule: number;
  workaround_available: boolean;
  needs_founder: boolean;
};

const UPSTREAM_CODES = new Set(['UPSTREAM_UNAVAILABLE', 'BACKEND_ERROR', 'BACKEND_TIMEOUT', 'INTERNAL_ERROR']);
const OWNER_CODES = new Set(['BUDGET_EXCEEDED', 'INSUFFICIENT_BALANCE']);
const SALES_WORDS = /\b(volume|enterprise|bulk|wholesale|discount|reseller|partnership|custom pricing)\b/i;
const WRONG_BILLING_WORDS = /\b(double|duplicate|wrong|over)[- ]?charg|charged (twice|but)|refund/i;

/**
 * Deterministic, ordered triage rules (proposal §3a). The first matching
 * rule wins; the reporter's category and severity are hints only.
 * Severity follows the owner's published definitions:
 * S1 outage or wrong billing (and security), S2 broken with no workaround,
 * S3 bug with a workaround, S4 question or feature request.
 */
export function triageTicket(input: TriageInput): TriageResult {
  const codes = input.error_codes;
  const hasUpstream = codes.some((c) => UPSTREAM_CODES.has(c)) || input.observed_statuses.some((s) => s >= 500);
  const workaround = Boolean(input.known_issue?.workaround);

  // 1. Security
  if (input.category === 'security' || input.credential_leak_detected) {
    return r('security', 'S1', 'founder', 'founder_immediately', 1, false, true);
  }
  // 2. Outage
  if (input.category === 'outage' || input.degraded_components.length > 0 && hasUpstream) {
    const widespread = input.degraded_components.length > 0 || input.category === 'outage';
    if (input.known_issue && workaround) {
      return r('outage', 'S3', 'product_bot', 'attach_to_known_issue', 2, true, false);
    }
    return r('outage', widespread ? 'S1' : 'S2', 'product_bot', 'attach_to_incident', 2, false, false);
  }
  // 3. Billing / refund (wrong billing is S1 per owner policy)
  if (input.category === 'refund_request' || input.category === 'billing') {
    const wrongBilling = input.category === 'refund_request' || WRONG_BILLING_WORDS.test(input.summary);
    return r('billing', wrongBilling ? 'S1' : 'S3', 'product_bot', 'investigate_then_founder_approval', 3, false, wrongBilling);
  }
  // 5 (checked before 4: these codes are also 4xx). Owner action
  if (codes.length > 0 && codes.every((c) => OWNER_CODES.has(c))) {
    return r('owner_action', 'S4', 'product_bot', 'auto_reply_ask_owner', 5, true, false);
  }
  // 4. Usage error: every code is a client error whose fix is known
  if (codes.length > 0 && codes.every((c) => {
    const e = getCatalogEntry(c);
    return e.status < 500 && ['fix_request', 'use_socks5', 'add_project_id', 'refresh_quote_and_retry', 'wait_and_retry', 'recreate_session'].includes(e.suggested_action);
  })) {
    return r('usage_error', 'S4', 'product_bot', 'auto_reply_catalog_steps', 4, true, false);
  }
  // 6. Bug
  if (input.category === 'bug' || hasUpstream) {
    if (workaround) return r('bug', 'S3', 'product_bot', 'attach_to_known_issue', 6, true, false);
    return r('bug', 'S2', 'product_bot', 'open_github_issue', 6, false, false);
  }
  // 7. Sales
  if (input.category === 'sales_pricing' || SALES_WORDS.test(input.summary)) {
    return r('sales', 'S4', 'sales_bot', 'handoff_to_sales', 7, false, false);
  }
  // 8. Feature
  if (input.category === 'feature_request') {
    return r('feature', 'S4', 'product_bot', 'feature_backlog', 8, false, false);
  }
  // 9. Abuse
  if (input.category === 'abuse_report') {
    return r('abuse', 'S2', 'founder', 'founder_policy_decision', 9, false, true);
  }
  return r('question', 'S4', 'product_bot', 'answer_question', 10, false, false);
}

function r(
  cls: TriageClass, severity: Severity, assignee_role: AssigneeRole, route: string,
  rule: number, workaround_available: boolean, needs_founder: boolean
): TriageResult {
  return { class: cls, severity, assignee_role, route, rule, workaround_available, needs_founder };
}
