import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100),
  contact_email: z
    .string()
    .email()
    .optional(),
  webhook_url: z
    .string()
    .url()
    .optional(),
  description: z
    .string()
    .max(500)
    .optional(),
  referral_code: z
    .string()
    .max(50)
    .optional(),
});

export type RegisterRequest = z.infer<
  typeof registerSchema
>;

export const requestApiKeySchema = z.object({
  email: z.string().email(),
  acquisition_source: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  referral_code: z
    .string()
    .max(50)
    .optional(),
});

export type RequestApiKeyRequest = z.infer<
  typeof requestApiKeySchema
>;

export const requestEmailLoginCodeSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

const accountPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const emailPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: accountPasswordSchema,
});

export const setEmailPasswordSchema = z.object({
  password: accountPasswordSchema,
});

export const updateBudgetSchema = z.object({
  key_limit_usd: z.number().positive().nullable().optional(),
  daily_limit_usd: z.number().positive().nullable().optional(),
  pause_on_exceed: z.boolean().default(true),
  alert_thresholds: z
    .array(z.number().int().min(1).max(100))
    .min(1)
    .max(10)
    .default([50, 80, 100]),
  paused: z.boolean().optional(),
});

export type UpdateBudgetRequest = z.infer<typeof updateBudgetSchema>;
