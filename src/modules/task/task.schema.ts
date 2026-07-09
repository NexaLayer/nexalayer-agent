import { z } from 'zod';

export const submitTaskSchema = z.object({
  profile_id: z.string().min(1),
  task_type: z
    .enum([
      'navigate', 'scrape', 'form_fill',
      'screenshot', 'custom_script',
    ])
    .default('navigate'),
  target_url: z.string().url().optional(),
  steps: z
    .array(z.object({
      action: z.string(),
      url: z.string().optional(),
      selector: z.string().optional(),
      value: z.string().optional(),
      script: z.string().optional(),
      wait_ms: z.number().optional(),
      timeout_ms: z.number().optional(),
    }))
    .optional(),
  script: z.string().optional(),
  timeout_ms: z.number().int().positive().default(60000),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .default('normal'),
  max_retries: z.number().int().min(0).max(5).default(1),
  idempotency_key: z.string().max(64).optional(),
});

export const batchTaskSchema = z.object({
  tasks: z.array(submitTaskSchema).min(1).max(50),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .default('normal'),
});

export const scheduleTaskSchema = submitTaskSchema.extend({
  schedule: z.object({
    type: z.enum(['delay', 'cron']),
    delay_seconds: z.number().int().positive().optional(),
    cron_expression: z.string().optional(),
  }),
});

export const listTasksSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  status: z.string().optional(),
  profile_id: z.string().optional(),
});

export type SubmitTaskRequest = z.infer<
  typeof submitTaskSchema
>;
export type ListTasksQuery = z.infer<
  typeof listTasksSchema
>;
