import { ERROR_CODES, HTTP_STATUS_FOR_ERROR } from '../../config/constants';
import { publicApiBase } from './support-contact';

export const ERROR_CATEGORIES = [
  'invalid_request', 'auth', 'payment', 'conflict', 'not_found',
  'rate_limit', 'upstream', 'internal',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const SUGGESTED_ACTIONS = [
  'retry_with_backoff', 'wait_and_retry', 'refresh_quote_and_retry', 'fix_request',
  'use_socks5', 'add_project_id', 'ask_owner_to_top_up', 'ask_owner_to_raise_budget',
  'rotate_session', 'recreate_session', 'check_status', 'report_issue', 'do_not_retry',
] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

export type SideEffectValue = boolean | 'unknown';
export type SideEffects = {
  charged: SideEffectValue;
  order_created: SideEffectValue;
  session_state_changed: SideEffectValue;
};

export type ErrorCatalogEntry = {
  code: string;
  status: number;
  category: ErrorCategory;
  retryable: boolean;
  /** Default Retry-After in seconds, when a retry is meaningful. */
  retry_after: number | null;
  suggested_action: SuggestedAction;
  side_effects: SideEffects;
  description: string;
  agent_steps: string[];
  owner_steps: string[];
};

const NONE: SideEffects = { charged: false, order_created: false, session_state_changed: false };
const UNKNOWN: SideEffects = { charged: 'unknown', order_created: 'unknown', session_state_changed: 'unknown' };

type Def = Omit<ErrorCatalogEntry, 'code' | 'status' | 'side_effects' | 'owner_steps' | 'retry_after'> & {
  side_effects?: SideEffects;
  owner_steps?: string[];
  retry_after?: number | null;
};

const C = ERROR_CODES;

const DEFS: Record<string, Def> = {
  [C.AUTH_INVALID_KEY]: {
    category: 'auth', retryable: false, suggested_action: 'do_not_retry',
    description: 'The X-API-Key header is missing or does not match an active key.',
    agent_steps: ['Stop calling authenticated endpoints.', 'Ask the owner to configure a valid NEXALAYER_API_KEY.'],
    owner_steps: ['Request a key at https://nexalayer.net/agents or rotate the existing one.'],
  },
  [C.AUTH_EXPIRED_TOKEN]: {
    category: 'auth', retryable: false, suggested_action: 'fix_request',
    description: 'The bearer token is invalid or expired.',
    agent_steps: ['Re-authenticate, or use the X-API-Key header instead of a bearer token.'],
  },
  [C.AUTH_INSUFFICIENT_PERMISSION]: {
    category: 'auth', retryable: false, suggested_action: 'do_not_retry',
    description: 'The key is valid but lacks the permission this endpoint needs.',
    agent_steps: ['Do not retry. Report the missing permission to the owner.'],
  },
  [C.ACCOUNT_DISABLED]: {
    category: 'auth', retryable: false, suggested_action: 'do_not_retry',
    description: 'The account behind this key is disabled.',
    agent_steps: ['Stop. Ask the owner to contact support.'],
    owner_steps: ['Email support with your account email. Never include the API key.'],
  },
  [C.RATE_LIMIT_EXCEEDED]: {
    category: 'rate_limit', retryable: true, retry_after: 60, suggested_action: 'wait_and_retry',
    description: 'Too many requests for this key or IP in the current window.',
    agent_steps: ['Wait Retry-After seconds, then retry the same request (same Idempotency-Key for writes).'],
  },
  [C.TRIAL_NOT_ELIGIBLE]: {
    category: 'rate_limit', retryable: false, suggested_action: 'do_not_retry',
    description: 'This email, device, or network is not eligible for another trial credit.',
    agent_steps: ['Do not retry. Ask the owner to top up instead.'],
  },
  [C.INSUFFICIENT_BALANCE]: {
    category: 'payment', retryable: false, suggested_action: 'ask_owner_to_top_up',
    description: 'The account balance cannot cover this purchase. No order was placed.',
    agent_steps: ['Do not retry. Ask the owner to top up, then retry with the same Idempotency-Key.'],
    owner_steps: ['Top up the account balance.'],
  },
  [C.BUDGET_EXCEEDED]: {
    category: 'payment', retryable: false, suggested_action: 'ask_owner_to_raise_budget',
    description: 'The per-key or daily spend cap would be exceeded. No order was placed; the key may be paused.',
    agent_steps: ['Do not retry. Read GET /v1/account/budget and ask the owner to raise or reset the cap.'],
    owner_steps: ['Raise the cap or unpause with PUT /v1/account/budget.'],
  },
  [C.SESSION_NOT_FOUND]: {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'No session with this id exists for this account.',
    agent_steps: ['List sessions with GET /v1/sessions and use an id from that list.'],
  },
  [C.SESSION_EXPIRED]: {
    category: 'not_found', retryable: false, suggested_action: 'recreate_session',
    description: 'The session has expired.',
    agent_steps: ['Create a new session (this is a paid action; follow your approval policy).'],
  },
  [C.SESSION_LIMIT_REACHED]: {
    category: 'rate_limit', retryable: false, suggested_action: 'fix_request',
    description: 'The account has reached its maximum number of active sessions.',
    agent_steps: ['Terminate sessions you no longer need with DELETE /v1/sessions/{id}, then retry.'],
  },
  [C.PRODUCT_NOT_FOUND]: {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'The product_no is unknown or no longer sold.',
    agent_steps: ['Re-list products with GET /v1/public/products and pick a current product_no.'],
  },
  [C.PRODUCT_OUT_OF_STOCK]: {
    category: 'conflict', retryable: true, retry_after: 300, suggested_action: 'fix_request',
    description: 'The product is out of stock. No order was placed.',
    agent_steps: ['Pick another in-stock product from GET /v1/public/products, or retry later.'],
  },
  [C.PRICE_MISMATCH]: {
    category: 'conflict', retryable: true, suggested_action: 'refresh_quote_and_retry',
    description: 'expected_price no longer matches the current price. No order was placed and nothing was charged.',
    agent_steps: ['Re-read GET /v1/public/products.', 'If the new price is still within your approval, retry once with the new expected_price.'],
  },
  [C.INVALID_REFERRAL_CODE]: {
    category: 'invalid_request', retryable: false, suggested_action: 'fix_request',
    description: 'The referral code format is invalid.',
    agent_steps: ['Remove the referral code or correct it, then retry.'],
  },
  [C.REFERRAL_CODE_NOT_FOUND]: {
    category: 'invalid_request', retryable: false, suggested_action: 'fix_request',
    description: 'The referral code does not exist.',
    agent_steps: ['Remove the referral code or correct it, then retry.'],
  },
  [C.INVALID_REQUEST]: {
    category: 'invalid_request', retryable: false, suggested_action: 'fix_request',
    description: 'The request failed validation. error.details lists the problems. Static sessions are SOCKS5 only.',
    agent_steps: ['Read error.details.issues, fix the parameters, and retry.', 'For static sessions use protocol=socks5 and pass project_id when the product requires it.'],
  },
  [C.ROUTE_NOT_FOUND]: {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'No route matches this method and path.',
    agent_steps: ['Check the path against the OpenAPI spec at https://docs.nexalayer.net/api-reference/openapi.json.'],
  },
  [C.IDEMPOTENCY_CONFLICT]: {
    category: 'conflict', retryable: false, suggested_action: 'fix_request',
    description: 'The Idempotency-Key was already used for a different request, or the original request is still in progress.',
    agent_steps: ['If you are retrying, send the identical body. If this is a new request, use a new Idempotency-Key.'],
  },
  [C.BACKEND_ERROR]: {
    category: 'upstream', retryable: true, retry_after: 30, suggested_action: 'check_status',
    side_effects: UNKNOWN,
    description: 'The upstream network returned an error. For writes the outcome may be unknown.',
    agent_steps: ['GET /v1/public/status.', 'For writes, reconcile with GET /v1/sessions before retrying with the same Idempotency-Key.', 'If it persists and no incident is open, file a ticket.'],
  },
  [C.BACKEND_TIMEOUT]: {
    category: 'upstream', retryable: true, retry_after: 30, suggested_action: 'check_status',
    side_effects: UNKNOWN,
    description: 'The upstream network timed out. For writes the outcome may be unknown.',
    agent_steps: ['GET /v1/public/status.', 'Reconcile with GET /v1/sessions before retrying writes with the same Idempotency-Key.'],
  },
  [C.UPSTREAM_UNAVAILABLE]: {
    category: 'upstream', retryable: true, retry_after: 60, suggested_action: 'check_status',
    side_effects: UNKNOWN,
    description: 'The upstream network is unavailable. For writes the outcome may be unknown; NexaLayer reconciles automatically.',
    agent_steps: ['GET /v1/public/status and wait while the component is not operational.', 'Reconcile with GET /v1/sessions/{id}.'],
  },
  [C.INTERNAL_ERROR]: {
    category: 'internal', retryable: true, retry_after: 30, suggested_action: 'report_issue',
    side_effects: UNKNOWN,
    description: 'An unexpected server error occurred.',
    agent_steps: ['Retry once after Retry-After.', 'If it repeats, file POST /v1/support/tickets with this request_id.'],
  },
  [C.TICKET_NOT_FOUND]: {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'No support ticket with this id exists for this account.',
    agent_steps: ['Use the ticket_id returned by POST /v1/support/tickets.'],
  },
  [C.ERROR_CODE_NOT_FOUND]: {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'The error code is not in the public catalog.',
    agent_steps: ['List all codes with GET /v1/public/errors.'],
  },
  [C.INVALID_STATE_TRANSITION]: {
    category: 'conflict', retryable: false, suggested_action: 'fix_request',
    description: 'The requested ticket state transition is not allowed.',
    agent_steps: ['Read GET /v1/public/support/ticket-states for allowed transitions.'],
  },
};

const GENERIC_NOT_FOUND = [
  C.PROFILE_NOT_FOUND, C.PROXY_NOT_FOUND, C.PROXY_POOL_NOT_FOUND, C.INSTANCE_NOT_FOUND, C.TASK_NOT_FOUND,
];
for (const code of GENERIC_NOT_FOUND) {
  DEFS[code] = {
    category: 'not_found', retryable: false, suggested_action: 'fix_request',
    description: 'The referenced resource does not exist for this account.',
    agent_steps: ['List the resource collection and use an existing id.'],
  };
}
const GENERIC_INVALID = [
  C.FINGERPRINT_INVALID, C.FINGERPRINT_INCONSISTENT, C.PROXY_VERIFY_FAILED, C.PROXY_IMPORT_FAILED,
  C.PROFILE_IMPORT_FAILED, C.TASK_ALREADY_COMPLETED,
];
for (const code of GENERIC_INVALID) {
  DEFS[code] = {
    category: 'invalid_request', retryable: false, suggested_action: 'fix_request',
    description: 'The request was rejected; see error.details.',
    agent_steps: ['Read error.details, fix the request, and retry.'],
  };
}
const GENERIC_LIMIT = [C.PROFILE_LIMIT_REACHED, C.INSTANCE_LIMIT_REACHED, C.TASK_QUEUE_FULL];
for (const code of GENERIC_LIMIT) {
  DEFS[code] = {
    category: 'rate_limit', retryable: true, retry_after: 60, suggested_action: 'wait_and_retry',
    description: 'A resource limit was reached.',
    agent_steps: ['Free existing resources or wait, then retry.'],
  };
}
const GENERIC_INTERNAL = [C.INSTANCE_LAUNCH_FAILED, C.BROWSER_CRASHED, C.SCRIPT_ERROR, C.SCRIPT_TIMEOUT];
for (const code of GENERIC_INTERNAL) {
  DEFS[code] = {
    category: 'internal', retryable: true, retry_after: 30, suggested_action: 'retry_with_backoff',
    side_effects: UNKNOWN,
    description: 'The operation failed while running.',
    agent_steps: ['Retry with backoff. If it repeats, file a support ticket with the request_id.'],
  };
}

function build(code: string, def: Def): ErrorCatalogEntry {
  return {
    code,
    status: HTTP_STATUS_FOR_ERROR[code] ?? 500,
    category: def.category,
    retryable: def.retryable,
    retry_after: def.retry_after ?? null,
    suggested_action: def.suggested_action,
    side_effects: def.side_effects ?? NONE,
    description: def.description,
    agent_steps: def.agent_steps,
    owner_steps: def.owner_steps ?? [],
  };
}

export const ERROR_CATALOG: Record<string, ErrorCatalogEntry> = Object.fromEntries(
  Object.entries(DEFS).map(([code, def]) => [code, build(code, def)])
);

export function getCatalogEntry(code: string): ErrorCatalogEntry {
  return ERROR_CATALOG[code] ?? build(code, {
    category: (HTTP_STATUS_FOR_ERROR[code] ?? 500) >= 500 ? 'internal' : 'invalid_request',
    retryable: false,
    suggested_action: 'report_issue',
    side_effects: UNKNOWN,
    description: 'Uncatalogued error.',
    agent_steps: ['File a support ticket with the request_id.'],
  });
}

export function errorDocUrl(code: string): string {
  return `${publicApiBase()}/v1/public/errors/${encodeURIComponent(code)}`;
}

export function listErrorCatalog() {
  return Object.values(ERROR_CATALOG)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((entry) => ({ ...entry, doc_url: errorDocUrl(entry.code) }));
}
