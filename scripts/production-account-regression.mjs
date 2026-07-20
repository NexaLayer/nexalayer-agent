import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const email = process.argv[2];
const provisioningMode = process.argv[3] ?? 'purchase';
if (!email) throw new Error('Usage: node scripts/production-account-regression.mjs <email>');
if (!['purchase', 'existing', 'inspect'].includes(provisioningMode)) {
  throw new Error('Provisioning mode must be purchase, existing, or inspect');
}

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3000/v1';
let key;
let sessionId;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, path, body, headers = {}) {
  const requestHeaders = { 'X-API-Key': key, ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`${method} ${path} (${response.status}): ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload.data ?? payload;
}

regression: try {
  const identity = await prisma.agentEmailIdentity.findFirst({
    where: { normalizedEmail: email.toLowerCase() },
    include: { agent: true },
  });
  const agent = identity?.agent ?? await prisma.agentApp.findFirst({
    where: { contactEmail: { equals: email, mode: 'insensitive' } },
  });
  if (!agent?.backendUserId) throw new Error('Ready backend account not found');
  key = agent.apiKey;

  const before = await api('GET', '/billing/balance');
  console.log(JSON.stringify({ step: 'balance_before', available: before.available_balance, cash: before.cash_balance }));
  const products = await api('GET', '/products?type=dynamic');
  const product = products.items?.find((item) => item.product_no);
  if (!product) throw new Error('No dynamic product available');
  console.log(JSON.stringify({ step: 'product', product_no: product.product_no, price: product.price, currency: product.currency }));
  if (provisioningMode === 'inspect') break regression;
  const expectedCharge = Number(product.price) * 0.25;
  if (provisioningMode === 'purchase' && Number(before.available_balance) < expectedCharge) {
    throw new Error(`At least ${expectedCharge} CNY backend balance is required for purchase mode`);
  }

  const created = await api('POST', '/sessions', {
    session_type: 'dynamic',
    product_no: product.product_no,
    provisioning_mode: provisioningMode,
    quantity: 0.25,
    protocol: 'socks5',
    rotation_mode: 'on_demand',
  }, { 'Idempotency-Key': `regression-${Date.now()}` });
  sessionId = created.session_id;
  console.log(JSON.stringify({ step: 'created', session_id: sessionId, status: created.status, estimated_charge_cny: created.billing?.estimated_charge_cny }));

  let session;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    session = await api('GET', `/sessions/${sessionId}`);
    if (session.status === 'active') break;
    if (['error', 'failed'].includes(session.status)) {
      throw new Error(`Provisioning failed: ${session.health?.last_error_type ?? session.status}`);
    }
    await sleep(2000);
  }
  if (session?.status !== 'active' || !session.proxy?.full_url) {
    throw new Error('Session did not return proxy.full_url within 120 seconds');
  }
  console.log(JSON.stringify({ step: 'proxy_ready', full_url_available: true, protocol: session.proxy.protocol }));

  const curl = spawnSync('curl', [
    '--silent', '--show-error', '--fail', '--max-time', '30',
    '--proxy', session.proxy.full_url,
    'https://httpbin.org/ip',
  ], { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Proxy request failed: ${curl.stderr.trim()}`);
  console.log(JSON.stringify({ step: 'proxy_request', success: Boolean(JSON.parse(curl.stdout).origin) }));

  await api('POST', `/sessions/${sessionId}/report-event`, {
    event_type: 'success', status_code: 200, target_host: 'httpbin.org', latency_ms: 1,
  });
  console.log(JSON.stringify({ step: 'telemetry', accepted: true }));

  const health = await api('GET', `/sessions/${sessionId}/health`);
  console.log(JSON.stringify({ step: 'health', score: health.health_score, risk: health.risk_level, recommendation: health.recommendation }));
} finally {
  try {
    if (sessionId && key) {
      const terminated = await api('DELETE', `/sessions/${sessionId}`);
      const finalSession = await api('GET', `/sessions/${sessionId}`);
      const after = await api('GET', '/billing/balance');
      console.log(JSON.stringify({ step: 'final', terminated: terminated.status, session_status: finalSession.status, available: after.available_balance, cash: after.cash_balance }));
    }
  } finally {
    await prisma.$disconnect();
  }
}
