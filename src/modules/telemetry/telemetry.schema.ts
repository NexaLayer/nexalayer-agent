import { z } from 'zod';

const eventTypes = [
  'success',
  'http_error',
  'captcha',
  'timeout',
  'block',
  'rate_limit',
  'custom',
] as const;

export const reportEventSchema = z.object({
  event_type: z.enum(eventTypes),
  status_code: z.number().int().optional(),
  target_host: z.string().max(200).optional(),
  latency_ms: z.number().int().min(0).optional(),
  error_message: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const batchReportSchema = z.object({
  events: z
    .array(
      reportEventSchema.extend({
        session_id: z.string(),
      })
    )
    .min(1)
    .max(100),
});

export type ReportEventRequest = z.infer<
  typeof reportEventSchema
>;
export type BatchReportRequest = z.infer<
  typeof batchReportSchema
>;
