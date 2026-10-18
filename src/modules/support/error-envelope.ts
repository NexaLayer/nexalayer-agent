import type { ApiError } from '../../types/api.types';
import { errorDocUrl, getCatalogEntry, type SideEffects } from './error-catalog';
import { matchKnownIssue } from './known-issues';
import { ERROR_SCHEMA_VERSION, supportContact } from './support-contact';

export type EnvelopeInput = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status: number;
  requestId: string;
  /** "METHOD /route/pattern" of the failing request, when known. */
  endpoint?: string;
};

/**
 * Build the structured, backward-compatible error object. Callers can
 * override `retry_after` and `side_effects` by putting them in details
 * (they are lifted out of details so they appear once).
 */
export function buildErrorEnvelope(input: EnvelopeInput): ApiError {
  const entry = getCatalogEntry(input.code);
  let details = input.details;
  let retryAfter = entry.retry_after;
  let sideEffects: SideEffects = entry.side_effects;

  if (details && typeof details === 'object') {
    const { side_effects, ...rest } = details as Record<string, unknown> & { side_effects?: unknown };
    if (typeof rest.retry_after === 'number' && Number.isFinite(rest.retry_after)) {
      retryAfter = Math.max(0, Math.ceil(rest.retry_after));
    }
    if (side_effects && typeof side_effects === 'object') {
      sideEffects = { ...sideEffects, ...(side_effects as Partial<SideEffects>) };
      details = rest;
    }
  }

  const knownIssue = matchKnownIssue([input.code], { endpoint: input.endpoint, requireEndpoint: true });
  const contact = supportContact();
  return {
    code: input.code,
    message: input.message,
    ...(details !== undefined ? { details } : {}),
    status: input.status,
    category: entry.category,
    retryable: entry.retryable,
    retry_after: retryAfter,
    suggested_action: entry.suggested_action,
    side_effects: sideEffects,
    doc_url: errorDocUrl(input.code),
    known_issue_id: knownIssue?.id ?? null,
    request_id: input.requestId,
    support: {
      email: contact.email,
      telegram: contact.telegram,
      ticket_api: contact.ticket_api,
    },
    error_schema_version: ERROR_SCHEMA_VERSION,
  };
}
