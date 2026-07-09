import { z } from 'zod';

export const rechargeSchema = z.object({
  amount: z.number().positive().min(1),
  currency: z.string().default('USDT'),
});

export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export type RechargeRequest = z.infer<
  typeof rechargeSchema
>;
export type ListTransactionsQuery = z.infer<
  typeof listTransactionsSchema
>;
