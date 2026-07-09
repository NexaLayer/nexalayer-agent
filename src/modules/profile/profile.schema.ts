import { z } from 'zod';

const fingerprintModeSchema = z
  .enum(['noise', 'block', 'real'])
  .optional();

const fingerprintSchema = z.object({
  os: z
    .enum(['windows', 'macos', 'linux', 'android', 'ios'])
    .optional(),
  browser: z
    .enum(['chrome', 'firefox', 'edge', 'safari'])
    .optional(),
  browser_version: z.string().optional(),
  user_agent: z.string().optional(),
  platform: z.string().optional(),
  screen: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      color_depth: z.number().int().optional(),
      device_pixel_ratio: z.number().optional(),
    })
    .optional(),
  hardware: z
    .object({
      cpu_cores: z.number().int().positive().optional(),
      memory_gb: z.number().positive().optional(),
      gpu_vendor: z.string().optional(),
      gpu_renderer: z.string().optional(),
      max_touch_points: z.number().int().optional(),
    })
    .optional(),
  canvas: z
    .object({
      mode: fingerprintModeSchema,
      noise_seed: z.number().optional(),
    })
    .optional(),
  webgl: z
    .object({
      mode: fingerprintModeSchema,
      vendor: z.string().optional(),
      renderer: z.string().optional(),
      noise_seed: z.number().optional(),
    })
    .optional(),
  audio: z
    .object({
      mode: fingerprintModeSchema,
      noise_seed: z.number().optional(),
    })
    .optional(),
  webrtc: z
    .object({
      mode: z.enum(['real', 'disabled', 'fake']).optional(),
      public_ip: z.string().optional(),
      local_ips: z.array(z.string()).optional(),
    })
    .optional(),
  location: z
    .object({
      timezone: z.string().optional(),
      locale: z.string().optional(),
      languages: z.array(z.string()).optional(),
      geo_latitude: z.number().optional(),
      geo_longitude: z.number().optional(),
    })
    .optional(),
  fonts: z.array(z.string()).optional(),
  plugins: z
    .array(
      z.object({
        name: z.string(),
        filename: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
  client_hints: z
    .object({
      brands: z.array(z.object({
        brand: z.string(),
        version: z.string(),
      })).optional(),
      mobile: z.boolean().optional(),
      platform: z.string().optional(),
      platform_version: z.string().optional(),
      architecture: z.string().optional(),
      bitness: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export const createProfileSchema = z.object({
  name: z.string().min(1).max(200),
  fingerprint: fingerprintSchema.optional(),
  tags: z.array(z.string()).optional(),
  group_id: z.string().optional(),
  notes: z.string().optional(),
  auto_generate_fingerprint: z.boolean().default(true),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  fingerprint: fingerprintSchema.optional(),
  tags: z.array(z.string()).optional(),
  group_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

export const listProfilesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  status: z.string().optional(),
  group_id: z.string().optional(),
  tags: z.string().optional(),
});

export const duplicateProfileSchema = z.object({
  new_name: z.string().min(1).max(200).optional(),
  regenerate_fingerprint: z.boolean().default(false),
});

export const batchCreateSchema = z.object({
  count: z.number().int().min(1).max(100),
  name_prefix: z.string().max(100).optional(),
  template: fingerprintSchema.optional(),
});

export const bindProxySchema = z.object({
  session_id: z.string().optional(),
  proxy_id: z.string().optional(),
  country: z.string().optional(),
  auto_match: z.boolean().default(false),
});

export const generateFingerprintSchema = z.object({
  os: z
    .enum(['windows', 'macos', 'linux', 'android', 'ios'])
    .optional(),
  browser: z
    .enum(['chrome', 'firefox', 'edge', 'safari'])
    .optional(),
  country: z.string().optional(),
  mode: z
    .enum(['random', 'template', 'custom'])
    .default('random'),
});

export const validateFingerprintSchema = z.object({
  fingerprint: fingerprintSchema,
  proxy_country: z.string().optional(),
});

export const importProfilesSchema = z.object({
  format: z.enum(['json']).default('json'),
  profiles: z.array(z.object({
    name: z.string(),
    fingerprint: fingerprintSchema.optional(),
    proxy: z.string().optional(),
    cookies: z.array(z.unknown()).optional(),
  })),
  auto_generate_fingerprint: z.boolean().default(true),
});

export const exportProfilesSchema = z.object({
  profile_ids: z.string().optional(),
  group: z.string().optional(),
  include_cookies: z
    .coerce.boolean()
    .default(false),
  include_storage: z
    .coerce.boolean()
    .default(false),
});

export type CreateProfileRequest = z.infer<
  typeof createProfileSchema
>;
export type UpdateProfileRequest = z.infer<
  typeof updateProfileSchema
>;
export type ListProfilesQuery = z.infer<
  typeof listProfilesSchema
>;
export type FingerprintConfig = z.infer<
  typeof fingerprintSchema
>;
export type GenerateFingerprintRequest = z.infer<
  typeof generateFingerprintSchema
>;
