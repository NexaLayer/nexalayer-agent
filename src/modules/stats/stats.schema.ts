import { z } from 'zod';

export const statsQuerySchema = z.object({
  period: z
    .enum(['day', 'week', 'month'])
    .default('day'),
});

export type StatsQuery = z.infer<
  typeof statsQuerySchema
>;
