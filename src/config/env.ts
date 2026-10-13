import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const logLevels = [
  'fatal', 'error', 'warn', 'info', 'debug', 'trace',
] as const;

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(
      z.enum(['development', 'production', 'test'])
    )
    .default('development'),
  LOG_LEVEL: z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.enum(logLevels))
    .default('info'),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),

  BACKEND_BASE_URL: z.string().min(1),
  BACKEND_ADMIN_USERNAME: z.string().min(1),
  BACKEND_ADMIN_PASSWORD: z.string().min(1),

  ENCRYPTION_KEY: z.string().min(32),

  RATE_LIMIT_PER_MIN: z.coerce.number().default(60),
  RATE_LIMIT_PER_DAY: z.coerce.number().default(10000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

  // $5 covers five 0.25 GB dynamic test sessions at the public $4/GB
  // starting price. Keep this aligned with scripts/calibrate-trial-credit.mjs.
  TRIAL_BALANCE: z.coerce.number().positive().default(5.0),
  TRIAL_DURATION_DAYS: z.coerce.number().default(30),
  TRIAL_MAX_CLAIMS_PER_IP_PER_DAY: z.coerce.number().int().positive().default(3),
  TRIAL_MAX_CLAIMS_PER_DEVICE: z.coerce.number().int().positive().default(1),
  TRIAL_DISPOSABLE_EMAIL_DOMAINS: z.string().default(''),
  TRIAL_ALERT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  TRIAL_ALERT_CLAIM_THRESHOLD: z.coerce.number().int().positive().default(20),
  TRIAL_ALERT_CHECK_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(300),
  TRIAL_ALERT_WEBHOOK_URL: z.preprocess(
    (v) => typeof v === 'string' && v.trim() ? v.trim() : undefined,
    z.string().url().optional()
  ),

  RESEND_API_KEY: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim()
        ? v.trim()
        : undefined,
    z.string().optional()
  ),
  RESEND_FROM_EMAIL: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim()
        ? v.trim()
        : undefined,
    z.string().email().optional()
  ),
  NEXALAYER_DOCS_URL: z
    .string()
    .url()
    .default('https://docs.nexalayer.net'),
  NEXALAYER_EXAMPLES_URL: z
    .string()
    .url()
    .default(
      'https://github.com/NexaLayer/nexalayer-examples'
    ),

  OPENAI_API_KEY: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v.trim().replace(/^=+/, '').trim() || undefined
        : undefined,
    z.string().optional()
  ),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z
    .string()
    .default('https://api.openai.com/v1'),

  DEEPSEEK_API_KEY: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v.trim().replace(/^=+/, '').trim() || undefined
        : undefined,
    z.string().optional()
  ),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z
    .string()
    .default('https://api.deepseek.com/v1'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;
