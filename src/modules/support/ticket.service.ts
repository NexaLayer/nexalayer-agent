import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { ERROR_CODES } from '../../config/constants';
import { AppError } from '../../utils/response';
import { OPS_ALERT_EVENTS, sendOpsAlert } from '../ops/ops-alert.service';
import { KNOWN_ISSUES, matchKnownIssue } from './known-issues';
import { redactDeep } from './redact';
import { firstResponseBy, type Severity } from './sla';
import { nonOperationalComponents } from './status.service';
import { publicApiBase, supportContact } from './support-contact';
import { canTransition, isTicketState, type TicketActor, type TicketState } from './ticket-state';
import type { CreateTicketInput } from './ticket.schema';
import { triageTicket } from './triage';

export const TICKET_LIMITS = { perHour: 5, perDay: 20 };
const AUTO_ATTACH_WINDOW_MS = 24 * 3_600_000;
const DEDUPE_WINDOW_MS = 24 * 3_600_000;
const NEXT_CHECK: Record<Severity, number> = { S1: 300, S2: 900, S3: 3_600, S4: 21_600 };

type TicketRow = Prisma.SupportTicketGetPayload<{ include: { events: true } }>;

export function newTicketId(): string {
  return `tkt_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
}

export function ticketFingerprint(agentId: number, category: string, errorCodes: string[], sessionId?: string | null): string {
  const key = [agentId, category, [...errorCodes].sort().join(','), sessionId ?? ''].join('|');
  return createHash('sha256').update(key).digest('hex');
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type CreateTicketOutcome = { statusCode: 200 | 201; data: ReturnType<typeof presentTicket> };

export async function createTicket(
  agentId: number,
  rawInput: CreateTicketInput,
  now: Date = new Date()
): Promise<CreateTicketOutcome> {
  // 1. Body idempotency (the Idempotency-Key header is handled by middleware).
  if (rawInput.idempotency_key) {
    const existing = await prisma.supportTicket.findUnique({
      where: { uq_support_ticket_idempotency: { agentId, idempotencyKey: rawInput.idempotency_key } },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return { statusCode: 200, data: presentTicket(existing, { deduplicated: true }) };
  }

  // 2. Per-key ticket rate limits.
  const [lastHour, lastDay] = await Promise.all([
    prisma.supportTicket.count({ where: { agentId, createdAt: { gte: new Date(now.getTime() - 3_600_000) } } }),
    prisma.supportTicket.count({ where: { agentId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
  ]);
  if (lastHour >= TICKET_LIMITS.perHour || lastDay >= TICKET_LIMITS.perDay) {
    const retryAfter = lastDay >= TICKET_LIMITS.perDay ? 3_600 : 600;
    throw new AppError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Support ticket limit reached for this API key', {
      limit_per_hour: TICKET_LIMITS.perHour,
      limit_per_day: TICKET_LIMITS.perDay,
      retry_after: retryAfter,
    });
  }

  // 3. Redact anything credential-like before it is stored or echoed.
  const { idempotency_key: idempotencyKey, ...body } = rawInput;
  const { value: input, count: redactions } = redactDeep(body);

  // 4. Validate and auto-attach request ids / error codes from this account's own logs.
  const supplied = uniq(input.request_ids ?? []);
  const ownSupplied = supplied.length
    ? await prisma.agentApiLog.findMany({
        where: { agentId, requestId: { in: supplied } },
        select: { requestId: true, statusCode: true, errorCode: true },
      })
    : [];
  const recent = await prisma.agentApiLog.findMany({
    where: {
      agentId,
      createdAt: { gte: new Date(now.getTime() - AUTO_ATTACH_WINDOW_MS) },
      statusCode: { gte: 400 },
      requestId: { not: null },
      NOT: { path: { startsWith: '/v1/support' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { requestId: true, statusCode: true, errorCode: true },
  });
  const ownIds = new Set(ownSupplied.map((l) => l.requestId));
  const droppedRequestIds = supplied.filter((id) => !ownIds.has(id)).length;
  const attachedLogs = [...ownSupplied, ...recent.filter((l) => !ownIds.has(l.requestId))].slice(0, 20);
  const requestIds = uniq(attachedLogs.map((l) => l.requestId).filter((v): v is string => Boolean(v)));
  const errorCodes = uniq([
    ...(input.error_codes ?? []),
    ...ownSupplied.map((l) => l.errorCode).filter((v): v is string => Boolean(v)),
  ]).slice(0, 10);
  const autoErrorCodes = uniq(recent.map((l) => l.errorCode).filter((v): v is string => Boolean(v)))
    .filter((c) => !errorCodes.includes(c)).slice(0, 10);
  const observedStatuses = attachedLogs.map((l) => l.statusCode ?? 0);

  // 5. Session must belong to this account; otherwise drop it silently.
  let sessionId: string | null = null;
  if (input.session_id) {
    const session = await prisma.agentSession.findFirst({ where: { agentId, sessionId: input.session_id }, select: { sessionId: true } });
    sessionId = session?.sessionId ?? null;
  }

  // 6. Duplicate within 24h → append to the existing open ticket.
  const fingerprint = ticketFingerprint(agentId, input.category, errorCodes, sessionId);
  const duplicate = await prisma.supportTicket.findFirst({
    where: {
      agentId,
      fingerprint,
      createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      status: { notIn: ['resolved', 'closed'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (duplicate) {
    await prisma.supportTicketEvent.create({
      data: { ticketId: duplicate.id, fromStatus: duplicate.status, toStatus: duplicate.status, actor: 'reporter', reason: 'duplicate_report', note: input.summary.slice(0, 1000) },
    });
    const updated = await prisma.supportTicket.update({
      where: { id: duplicate.id },
      data: { duplicateCount: { increment: 1 } },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    return { statusCode: 200, data: presentTicket(updated, { deduplicated: true, redactions }) };
  }

  // 7. Triage.
  const knownIssue =
    (input.known_issue_id ? matchKnownIssueById(input.known_issue_id) : null) ??
    matchKnownIssue([...errorCodes, ...autoErrorCodes]);
  const triage = triageTicket({
    category: input.category,
    severity_claimed: input.severity_claimed,
    error_codes: errorCodes.length ? errorCodes : autoErrorCodes,
    summary: input.summary,
    credential_leak_detected: redactions > 0,
    degraded_components: await nonOperationalComponents(),
    known_issue: knownIssue,
    observed_statuses: observedStatuses,
  });
  const severity = triage.severity;
  const responseBy = firstResponseBy(severity, now);

  const created = await prisma.supportTicket.create({
    data: {
      ticketId: newTicketId(),
      agentId,
      category: input.category,
      severity,
      severityClaimed: input.severity_claimed ?? null,
      status: 'triaged',
      triageClass: triage.class,
      assigneeRole: triage.assignee_role,
      route: triage.route,
      summary: input.summary,
      sessionId,
      requestIds: requestIds as Prisma.InputJsonValue,
      errorCodes: errorCodes as Prisma.InputJsonValue,
      details: {
        occurred_at: input.occurred_at ?? null,
        reproduction: input.reproduction ?? null,
        client: input.client ?? null,
        desired_outcome: input.desired_outcome ?? null,
        notify: input.notify ?? null,
        auto_attached_error_codes: autoErrorCodes,
        dropped_request_ids: droppedRequestIds,
        triage_rule: triage.rule,
        needs_founder: triage.needs_founder,
        workaround_available: triage.workaround_available,
      } as Prisma.InputJsonValue,
      knownIssueId: knownIssue?.id ?? null,
      fingerprint,
      idempotencyKey: idempotencyKey ?? null,
      redactionsApplied: redactions,
      firstResponseBy: responseBy,
      events: {
        create: [
          { fromStatus: null, toStatus: 'received', actor: 'reporter', reason: 'ticket_created' },
          { fromStatus: 'received', toStatus: 'triaged', actor: 'product_bot', reason: 'auto_classified', note: `rule ${triage.rule}: ${triage.class} -> ${triage.route}` },
        ],
      },
    },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });

  if (severity === 'S1' || severity === 'S2') {
    void sendOpsAlert(
      OPS_ALERT_EVENTS.SUPPORT_TICKET_URGENT,
      severity === 'S1' ? 'critical' : 'warning',
      {
        ticket_id: created.ticketId,
        agent_id: agentId,
        ticket_severity: severity,
        category: input.category,
        triage: `${triage.class} -> ${triage.route}`,
        summary: input.summary,
        error_codes: errorCodes.join(',') || autoErrorCodes.join(','),
        first_response_by: responseBy?.toISOString() ?? 'best_effort',
      },
      { dedupeKey: created.ticketId }
    );
  }

  return { statusCode: 201, data: presentTicket(created, { deduplicated: false, redactions, droppedRequestIds }) };
}

function matchKnownIssueById(id: string) {
  return KNOWN_ISSUES.find((k) => k.id === id) ?? null;
}

export async function getTicket(agentId: number, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { agentId, ticketId },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!ticket) throw new AppError(ERROR_CODES.TICKET_NOT_FOUND, 'Support ticket not found');
  return presentTicket(ticket, {});
}

export async function listTickets(agentId: number, status?: string) {
  const where: Prisma.SupportTicketWhereInput = { agentId };
  if (status === 'open') where.status = { notIn: ['resolved', 'closed'] };
  else if (status && isTicketState(status)) where.status = status;
  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  return { items: tickets.map((t) => presentTicket(t, {})) };
}

/** Admin / bot path: move a ticket through the state machine. */
export async function transitionTicket(
  ticketId: string,
  input: { to: string; actor: TicketActor; reason: string; note?: string; severity?: Severity; resolution?: Record<string, unknown> }
) {
  const ticket = await prisma.supportTicket.findUnique({ where: { ticketId } });
  if (!ticket) throw new AppError(ERROR_CODES.TICKET_NOT_FOUND, 'Support ticket not found');
  const from = ticket.status as TicketState;
  if (!isTicketState(input.to) || !isTicketState(from) || !canTransition(from, input.to, input.actor)) {
    throw new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, `Transition ${from} -> ${input.to} is not allowed for ${input.actor}`, {
      from, to: input.to, actor: input.actor,
    });
  }
  const { value: note } = redactDeep(input.note ?? null);
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: input.to,
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.resolution ? { resolution: redactDeep(input.resolution).value as Prisma.InputJsonValue } : {}),
      events: { create: { fromStatus: from, toStatus: input.to, actor: input.actor, reason: input.reason, note } },
    },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
  return presentTicket(updated, {});
}

export function presentTicket(
  t: TicketRow,
  extra: { deduplicated?: boolean; redactions?: number; droppedRequestIds?: number }
) {
  const severity = t.severity as Severity;
  const details = (t.details ?? {}) as Record<string, unknown>;
  const issue = t.knownIssueId ? matchKnownIssueById(t.knownIssueId) : null;
  return {
    ticket_id: t.ticketId,
    status: t.status,
    severity,
    severity_claimed: t.severityClaimed,
    category: t.category,
    triage_class: t.triageClass,
    assignee_role: t.assigneeRole,
    route: t.route,
    summary: t.summary,
    session_id: t.sessionId,
    request_ids: t.requestIds,
    error_codes: t.errorCodes,
    auto_attached_error_codes: details.auto_attached_error_codes ?? [],
    ...(extra.deduplicated !== undefined ? { deduplicated: extra.deduplicated } : {}),
    duplicate_count: t.duplicateCount,
    redactions_applied: extra.redactions ?? t.redactionsApplied,
    ...(extra.droppedRequestIds ? { dropped_request_ids: extra.droppedRequestIds } : {}),
    matched_known_issue: issue
      ? {
          id: issue.id,
          status: issue.status,
          workaround_available: Boolean(issue.workaround),
          workaround: issue.workaround,
          url: `${publicApiBase()}/v1/public/known-issues?id=${issue.id}`,
        }
      : null,
    response_target: {
      first_response_by: t.firstResponseBy?.toISOString() ?? null,
      kind: 'early_access_target_not_guarantee',
      sla: `${publicApiBase()}/v1/public/sla`,
    },
    next_check_after_seconds: NEXT_CHECK[severity] ?? 3_600,
    resolution: t.resolution ?? null,
    events: t.events.map((e) => ({
      at: e.createdAt.toISOString(),
      from: e.fromStatus,
      to: e.toStatus,
      actor: e.actor,
      reason: e.reason,
    })),
    human_contact: supportContact(),
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
    links: { self: `${publicApiBase()}/v1/support/tickets/${t.ticketId}` },
  };
}
