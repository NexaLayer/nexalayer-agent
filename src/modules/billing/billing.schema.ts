import { z } from 'zod';

export const rechargeSchema = z
  .object({
    amount_usd: z.number().positive().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().default('USDT'),
  })
  .transform((value) => ({
    amount_usd: value.amount_usd ?? value.amount,
    currency: value.currency,
  }))
  .refine(
    (value) => value.amount_usd !== undefined,
    {
      message: 'amount_usd is required',
      path: ['amount_usd'],
    }
  )
  .refine(
    (value) => value.amount_usd! >= 10,
    {
      message: 'Minimum recharge is 10 USD',
      path: ['amount_usd'],
    }
  );

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
