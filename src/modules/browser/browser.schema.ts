import { z } from 'zod';

export const launchBrowserSchema = z.object({
  profile_id: z.string().min(1),
  headless: z.boolean().default(true),
  options: z
    .object({
      start_url: z.string().url().optional(),
      viewport: z
        .object({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .optional(),
      timeout_ms: z.number().int().positive().optional(),
    })
    .optional(),
});

export const navigateSchema = z.object({
  url: z.string().url(),
  wait_until: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .default('load'),
  timeout_ms: z.number().int().positive().default(30000),
});

const actionSchema = z.object({
  type: z.string(),
  selector: z.string().optional(),
  value: z.string().optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  ms: z.number().optional(),
  timeout_ms: z.number().optional(),
  script: z.string().optional(),
  url: z.string().optional(),
  action: z.string().optional(),
  source: z.string().optional(),
  target: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  direction: z.string().optional(),
  button: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  file_path: z.string().optional(),
  file_url: z.string().optional(),
  url_pattern: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  status: z.number().optional(),
  full_page: z.boolean().optional(),
  format: z.string().optional(),
  state: z.string().optional(),
  values: z.array(z.string()).optional(),
  args: z.array(z.unknown()).optional(),
  trigger_selector: z.string().optional(),
  capture_headers: z.boolean().optional(),
  capture_body: z.boolean().optional(),
});

export const executeSchema = z.object({
  actions: z.array(actionSchema).min(1).max(50),
});

export const evaluateSchema = z.object({
  script: z.string().min(1),
  timeout_ms: z.number().int().positive().default(5000),
});

export const screenshotSchema = z.object({
  type: z
    .enum(['viewport', 'full_page', 'element'])
    .default('viewport'),
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  selector: z.string().optional(),
});

export const closeBrowserSchema = z.object({
  save_cookies: z.boolean().default(true),
  save_storage: z.boolean().default(false),
  force: z.boolean().default(false),
});

export const batchLaunchSchema = z.object({
  profile_ids: z.array(z.string()).min(1).max(20),
  headless: z.boolean().default(true),
  start_url: z.string().url().optional(),
});

export const batchCloseSchema = z.object({
  instance_ids: z.array(z.string()).optional(),
  save_cookies: z.boolean().default(true),
});

export const listInstancesSchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export const networkMonitorSchema = z.object({
  action: z.enum(['start', 'stop']),
  url_pattern: z.string().optional(),
  capture_headers: z.boolean().default(true),
  capture_body: z.boolean().default(false),
});

export type LaunchBrowserRequest = z.infer<
  typeof launchBrowserSchema
>;
export type NavigateRequest = z.infer<
  typeof navigateSchema
>;
export type ExecuteRequest = z.infer<
  typeof executeSchema
>;
