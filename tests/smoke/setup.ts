export const AGENT_BASE_URL =
  process.env.AGENT_BASE_URL ??
  'https://aiagent-production-9411.up.railway.app';

export const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ??
  'https://backend-production-127a.up.railway.app';

export const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ??
  'http://surprising-rejoicing.railway.internal:8080';

export const BACKEND_AGENT_USERNAME =
  process.env.BACKEND_AGENT_USERNAME ?? 'openAgent';

export const BACKEND_AGENT_PASSWORD =
  process.env.BACKEND_AGENT_PASSWORD ?? '';

export const AGENT_DATABASE_URL =
  process.env.AGENT_DATABASE_URL ?? '';

const PRODUCTION_MARKERS = [
  'production',
  'prod',
  'live',
];

export function enforceEnvironmentGuard(): void {
  const url = AGENT_BASE_URL.toLowerCase();
  const allowProd =
    process.env.ALLOW_PROD === 'true';

  const looksLikeProduction = PRODUCTION_MARKERS.some(
    (m) => url.includes(m)
  );

  if (looksLikeProduction && !allowProd) {
    console.warn(
      '[ENV GUARD] AGENT_BASE_URL contains ' +
        '"production". Set ALLOW_PROD=true to ' +
        'proceed.'
    );
  }
}

export function isDatabaseReachable(): boolean {
  return AGENT_DATABASE_URL.length > 0;
}
