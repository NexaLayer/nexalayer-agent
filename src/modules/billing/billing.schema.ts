import { z } from 'zod';

export const rechargeSchema = z
  .object({
    amount_cny: z.number().positive().optional(),
    amount_usd: z.number().positive().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().default('USDT'),
  })
  .transform((value) => ({
    amount_cny:
      value.amount_cny ?? value.amount_usd ?? value.amount,
    currency: value.currency,
  }))
  .refine(
    (value) => value.amount_cny !== undefined,
    {
      message: 'amount_cny is required',
      path: ['amount_cny'],
    }
  )
  .refine(
    (value) => value.amount_cny! >= 10,
    {
      message: 'Minimum recharge is 10 CNY',
      path: ['amount_cny'],
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
