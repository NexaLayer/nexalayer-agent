import { z } from 'zod';

export const listProductsSchema = z.object({
  type: z
    .enum(['static', 'dynamic', 'all'])
    .default('all'),
  country_code: z.string().optional(),
});

export type ListProductsQuery = z.infer<
  typeof listProductsSchema
>;
