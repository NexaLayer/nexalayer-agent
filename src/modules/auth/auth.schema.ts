import { z } from 'zod';

export const tokenRequestSchema = z.object({
  api_key: z
    .string()
    .min(1, 'api_key is required'),
  api_secret: z
    .string()
    .min(1, 'api_secret is required'),
});

export type TokenRequest = z.infer<
  typeof tokenRequestSchema
>;
