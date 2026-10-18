import { z } from 'zod';
import { TICKET_CATEGORIES } from './triage';

const severity = z.enum(['S1', 'S2', 'S3', 'S4']);

export const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  severity_claimed: severity.optional(),
  summary: z.string().trim().min(1).max(200),
  request_ids: z.array(z.string().regex(/^req_[A-Za-z0-9]+$/)).max(20).optional(),
  session_id: z.string().max(50).optional(),
  error_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/).max(64)).max(10).optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  known_issue_id: z.string().max(40).optional(),
  reproduction: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'MCP']).optional(),
    endpoint_or_tool: z.string().max(200).optional(),
    params_redacted: z.record(z.unknown()).optional(),
    expected: z.string().max(1000).optional(),
    actual: z.string().max(1000).optional(),
    attempts: z.number().int().min(1).max(1000).optional(),
  }).strict().optional(),
  client: z.object({
    agent_name: z.string().max(100).optional(),
    agent_version: z.string().max(50).optional(),
    via: z.enum(['rest', 'mcp', 'python_sdk', 'other']).optional(),
    sdk_or_mcp_version: z.string().max(60).optional(),
    mcp_client: z.string().max(100).optional(),
  }).strict().optional(),
  desired_outcome: z.enum(['fix', 'workaround', 'refund_review', 'explanation', 'feature']).optional(),
  notify: z.object({
    owner_email_cc: z.boolean().optional(),
  }).strict().optional(),
  /** Alternative to the Idempotency-Key header. */
  idempotency_key: z.string().min(1).max(64).optional(),
}).strict();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const adminTransitionSchema = z.object({
  to: z.string(),
  actor: z.enum(['product_bot', 'founder', 'system', 'reporter']).default('product_bot'),
  reason: z.string().min(1).max(80),
  note: z.string().max(1000).optional(),
  severity: severity.optional(),
  resolution: z.record(z.unknown()).optional(),
}).strict();

export const adminComponentSchema = z.object({
  status: z.enum(['operational', 'degraded_performance', 'partial_outage', 'major_outage', 'under_maintenance']),
  reason: z.string().max(300).optional(),
}).strict();
