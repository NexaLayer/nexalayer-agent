import { timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import { ERROR_CODES } from '../../config/constants';
import { authGuard } from '../../middleware/auth.middleware';
import { idempotencyGuard } from '../../middleware/idempotency';
import { AppError, sendSuccess } from '../../utils/response';
import { ERROR_CATALOG, errorDocUrl, listErrorCatalog, SUGGESTED_ACTIONS, ERROR_CATEGORIES } from './error-catalog';
import { KNOWN_ISSUES, listKnownIssues } from './known-issues';
import { buildSla } from './sla';
import { getPublicStatus, isComponentId, setComponentStatus } from './status.service';
import { ticketStateMachine } from './ticket-state';
import { adminComponentSchema, adminTransitionSchema, createTicketSchema } from './ticket.schema';
import { createTicket, getTicket, listTickets, transitionTicket } from './ticket.service';
import { supportContact } from './support-contact';

const PUBLIC_RATE = { rateLimit: { max: 120, timeWindow: '1 minute' } };

function cache(reply: FastifyReply, seconds: number) {
  reply.header('Cache-Control', `public, max-age=${seconds}`);
}

/** Public, unauthenticated, machine-readable support feeds under /v1/public. */
export async function publicSupportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/status', { config: PUBLIC_RATE }, async (request, reply) => {
    cache(reply, 30);
    return sendSuccess(reply, await getPublicStatus(), 200, request.startTime);
  });

  app.get('/known-issues', { config: PUBLIC_RATE }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    cache(reply, 60);
    const items = q.id
      ? KNOWN_ISSUES.filter((k) => k.id === q.id)
      : listKnownIssues({ status: q.status, error_code: q.error_code, component: q.component, since: q.since });
    return sendSuccess(reply, { items, total: items.length }, 200, request.startTime);
  });

  app.get('/errors', { config: PUBLIC_RATE }, async (request, reply) => {
    cache(reply, 300);
    const items = listErrorCatalog();
    return sendSuccess(reply, {
      error_schema_version: '1',
      categories: ERROR_CATEGORIES,
      suggested_actions: SUGGESTED_ACTIONS,
      self_serve_procedure: SELF_SERVE_PROCEDURE,
      items,
      total: items.length,
    }, 200, request.startTime);
  });

  app.get('/errors/:code', { config: PUBLIC_RATE }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const entry = ERROR_CATALOG[code.toUpperCase()];
    if (!entry) throw new AppError(ERROR_CODES.ERROR_CODE_NOT_FOUND, `Unknown error code: ${code.slice(0, 64)}`);
    cache(reply, 300);
    return sendSuccess(reply, {
      ...entry,
      doc_url: errorDocUrl(entry.code),
      related_known_issues: listKnownIssues({ status: 'open', error_code: entry.code }).map((k) => k.id),
      human_doc: `https://docs.nexalayer.net/en/errors#${entry.code.toLowerCase()}`,
    }, 200, request.startTime);
  });

  app.get('/sla', { config: PUBLIC_RATE }, async (request, reply) => {
    cache(reply, 3600);
    return sendSuccess(reply, buildSla(), 200, request.startTime);
  });

  app.get('/support/ticket-states', { config: PUBLIC_RATE }, async (request, reply) => {
    cache(reply, 3600);
    return sendSuccess(reply, { ...ticketStateMachine(), contact: supportContact() }, 200, request.startTime);
  });
}

export const SELF_SERVE_PROCEDURE = [
  'on error E:',
  '  1. if E.retryable and E.retry_after: wait E.retry_after; retry once (same Idempotency-Key)',
  '  2. if E.suggested_action not in {report_issue, check_status}: perform it; stop',
  '  3. GET /v1/public/status -> if the affected component is not operational: wait_and_retry or pause; stop',
  '  4. if E.known_issue_id or GET /v1/public/known-issues?error_code=E.code matches: run workaround.steps; stop',
  '  5. GET E.doc_url -> follow agent_steps',
  '  6. POST /v1/support/tickets with request_ids, error_codes, session_id, reproduction, client',
  '  7. poll GET /v1/support/tickets/{id} no sooner than next_check_after_seconds',
  'never: send API keys, proxy credentials, or full_url; never retry paid writes without the same Idempotency-Key',
].join('\n');

function agentIdOf(request: FastifyRequest): number {
  const id = request.agentContext?.agentId;
  if (!id) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  return id;
}

/** Agent ticket API under /v1/support (X-API-Key, scoped to the key's account). */
export async function supportTicketRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/tickets', {
    bodyLimit: 32 * 1024,
    preHandler: idempotencyGuard,
  }, async (request, reply) => {
    const input = createTicketSchema.parse(request.body ?? {});
    const outcome = await createTicket(agentIdOf(request), input);
    return sendSuccess(reply, outcome.data, outcome.statusCode, request.startTime);
  });

  app.get('/tickets', async (request, reply) => {
    const { status } = request.query as { status?: string };
    return sendSuccess(reply, await listTickets(agentIdOf(request), status), 200, request.startTime);
  });

  app.get('/tickets/:ticket_id', async (request, reply) => {
    const { ticket_id } = request.params as { ticket_id: string };
    return sendSuccess(reply, await getTicket(agentIdOf(request), ticket_id), 200, request.startTime);
  });
}

export function adminTokenMatches(header: string | undefined, token: string | undefined): boolean {
  if (!token || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Owner/bot admin path under /v1/admin (Bearer OPS_ADMIN_TOKEN). Disabled when unset. */
export async function supportAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (request) => {
    if (!env.OPS_ADMIN_TOKEN) {
      throw new AppError(ERROR_CODES.ROUTE_NOT_FOUND, 'Route not found');
    }
    if (!adminTokenMatches(request.headers.authorization, env.OPS_ADMIN_TOKEN)) {
      throw new AppError(ERROR_CODES.AUTH_INSUFFICIENT_PERMISSION, 'Admin token required');
    }
  });

  app.post('/status/components/:component_id', async (request, reply) => {
    const { component_id } = request.params as { component_id: string };
    if (!isComponentId(component_id)) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, `Unknown component: ${component_id.slice(0, 40)}`);
    }
    const body = adminComponentSchema.parse(request.body ?? {});
    const result = await setComponentStatus(component_id, body.status, 'admin', body.reason ?? null);
    return sendSuccess(reply, { component: component_id, ...result }, 200, request.startTime);
  });

  app.post('/support/tickets/:ticket_id/transition', async (request, reply) => {
    const { ticket_id } = request.params as { ticket_id: string };
    const body = adminTransitionSchema.parse(request.body ?? {});
    return sendSuccess(reply, await transitionTicket(ticket_id, body), 200, request.startTime);
  });
}
