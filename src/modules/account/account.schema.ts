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
