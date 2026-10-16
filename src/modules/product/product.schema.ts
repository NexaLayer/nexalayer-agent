import { z } from 'zod';

const queryBoolean = z.preprocess(
  (value) => value === 'true' ? true : value === 'false' ? false : value,
  z.boolean()
);

export const listProductsSchema = z.object({
  type: z
    .enum(['static', 'dynamic', 'all'])
    .default('all'),
  country: z.string().optional(),
  country_code: z.string().optional(),
  in_stock: queryBoolean.default(true),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type ListProductsQuery = z.infer<
  typeof listProductsSchema
>;
