import { z } from 'zod';

export const createSessionSchema = z.object({
  session_type: z.enum(['static', 'dynamic']),
  product_no: z.string().min(1),
  provisioning_mode: z
    .enum(['purchase', 'existing'])
    .default('purchase'),
  resource_id: z.string().min(1).optional(),
  country_code: z.string().optional(),
  city_code: z.string().optional(),
  project_id: z.string().min(1).optional(),
  isp_type: z.string().optional(),
  quantity: z.number().positive().default(1),
  duration: z.number().int().positive().optional(),
  protocol: z
    .enum(['socks5', 'http', 'https'])
    .default('socks5'),
  rotation_mode: z
    .enum(['fixed', 'timed', 'on_demand'])
    .default('fixed'),
  rotation_interval_sec: z
    .number()
    .int()
    .min(0)
    .default(0),
  identity_id: z.string().uuid().optional(),
  identity_pool: z.string().max(50).optional(),
}).superRefine((value, ctx) => {
  if (
    value.session_type === 'static' &&
    !Number.isInteger(value.quantity)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantity'],
      message: 'Static session quantity must be an integer',
    });
  }
});

export const rotateSessionSchema = z.object({
  reason: z
    .string()
    .max(50)
    .optional()
    .default('manual'),
});

export const renewSessionSchema = z.object({
  duration: z.number().int().positive(),
});

export const listSessionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  status: z.string().optional(),
  session_type: z
    .enum(['static', 'dynamic'])
    .optional(),
});

export const whitelistSchema = z.object({
  ips: z.array(z.string().ip()).min(1).max(20),
});

export type CreateSessionRequest = z.infer<
  typeof createSessionSchema
>;
export type RotateSessionRequest = z.infer<
  typeof rotateSessionSchema
>;
export type RenewSessionRequest = z.infer<
  typeof renewSessionSchema
>;
export type ListSessionsQuery = z.infer<
  typeof listSessionsSchema
>;
export type WhitelistRequest = z.infer<
  typeof whitelistSchema
>;
