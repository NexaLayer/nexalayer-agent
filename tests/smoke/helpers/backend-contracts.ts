import { z } from 'zod';

export const BackendDynamicProductSchema = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string(),
  proxyType: z.number(),
  price: z.number(),
  unit: z.number().optional(),
  flow: z.number().optional(),
  duration: z.number().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  isGlobal: z.boolean().optional(),
  stock: z.number().optional(),
});

export const BackendStaticProductSchema = z.object({
  productId: z.string(),
  name: z.string(),
  proxyType: z.number(),
  price: z.number(),
  stock: z.number(),
  area: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  flow: z.number().optional().nullable(),
  duration: z.number().optional().nullable(),
  unit: z.number().optional().nullable(),
  supplierCode: z.string().optional().nullable(),
  status: z.number(),
  minAgentPrice: z.number().optional().nullable(),
});

export const BackendAreaSchema = z.object({
  areas: z.array(z.object({
    areaCode: z.string(),
    areaName: z.string(),
    countries: z.array(z.object({
      countryCode: z.string(),
      countryName: z.string(),
      areaCode: z.string(),
      cities: z.array(z.object({
        cityCode: z.string(),
        cityName: z.string(),
        countryCode: z.string(),
      })),
    })),
  })),
  countries: z.array(z.unknown()),
  cities: z.array(z.unknown()),
});

export const BackendLoginSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.number(),
    username: z.string(),
    balance: z.number(),
    email: z.string().nullable().optional(),
    is_admin: z.boolean().optional(),
    is_agent: z.boolean().optional(),
    status: z.string().optional(),
    remark: z.string().nullable().optional(),
    created_at: z.string().optional(),
    last_login_at: z.string().optional(),
  }),
});

export const BackendResponseSchema = <
  T extends z.ZodType
>(
  dataSchema: T
) =>
  z.object({
    code: z.number(),
    message: z.string().optional(),
    msg: z.string().optional(),
    data: dataSchema,
  });

export const CONTRACT_VERSION = '2026-02-23_v1';
