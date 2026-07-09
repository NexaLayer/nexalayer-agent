const BASE_URL =
  process.env.NEXALAYER_BASE_URL ?? 'https://api.nexalayer.net/v1';
const ALLOW_PAID = process.env.PHASE0_ALLOW_PAID === '1';
const SHOULD_REGISTER =
  process.env.PHASE0_REGISTER === '1' ||
  !process.env.NEXALAYER_API_KEY;
const PRINT_PROXY_URL =
  process.env.PHASE0_PRINT_PROXY_URL === '1';
const TEST_PROXY =
  process.env.PHASE0_TEST_PROXY !== '0';
const SESSION_TIMEOUT_MS = Number(
  process.env.PHASE0_SESSION_TIMEOUT_MS ?? 90_000
);
const POLL_MS = Number(process.env.PHASE0_POLL_MS ?? 3_000);

let apiKey = process.env.NEXALAYER_API_KEY ?? '';
let sessionId = '';

function log(label, data) {
  console.log(JSON.stringify({ label, ...data }));
}

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json?.success === false) {
    const err = new Error(
      `${method} ${path} failed: HTTP ${res.status} ` +
        `${json?.error?.code ?? json?.code ?? ''} ` +
        `${json?.error?.message ?? json?.msg ?? ''}`
    );
    err.response = json;
    err.status = res.status;
    throw err;
  }
  return json?.data;
}

async function register() {
  const suffix = Date.now().toString(36).slice(-8);
  const name =
    process.env.PHASE0_AGENT_NAME ?? `phase0-${suffix}`;
  const data = await api('POST', '/account/register', {
    name,
    contact_email:
      process.env.PHASE0_CONTACT_EMAIL ??
      `${name}@nexalayer.net`,
  });
  apiKey = data.api_key;
  log('register', {
    agent_id: data.agent_id,
    backend_ready: data.backend_ready,
    trial_balance: data.trial?.trial_balance,
    has_api_key: Boolean(apiKey),
  });
  if (!data.backend_ready) {
    throw new Error(
      `backend_ready=false: ${data.backend_sync_error ?? 'unknown'}`
    );
  }
}

async function pickDynamicProduct() {
  const data = await api('GET', '/products?type=dynamic');
  const items = data.items ?? [];
  log('products.dynamic', {
    total: data.total ?? items.length,
    sample: items.slice(0, 3).map((p) => ({
      product_no: p.product_no,
      price: p.price,
      unit: p.unit,
    })),
  });
  const configured = process.env.NEXALAYER_PRODUCT_NO;
  if (configured) return configured;
  const sorted = items
    .filter((p) => p.product_no)
    .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  if (!sorted.length) {
    throw new Error('No dynamic product available');
  }
  return sorted[0].product_no;
}

async function waitForActive(id) {
  const deadline = Date.now() + SESSION_TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    last = await api('GET', `/sessions/${id}`);
    log('session.poll', { session_id: id, status: last.status });
    if (last.status === 'active') return last;
    if (last.status === 'error') {
      throw new Error(
        `Session entered error state: ${last.health?.last_error_type ?? ''}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Session did not become active: ${JSON.stringify(last)}`);
}

function maskProxy(proxy) {
  if (!proxy) return null;
  return {
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    has_username: Boolean(proxy.username),
    has_password: Boolean(proxy.password),
    full_url: PRINT_PROXY_URL ? proxy.full_url : undefined,
  };
}

async function tryProxy(proxyUrl) {
  if (!TEST_PROXY || !proxyUrl) {
    return { event_type: 'success', status_code: 200, skipped: true };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch('https://httpbin.org/ip', {
      signal: controller.signal,
      // Node fetch does not use proxy URLs directly. Connectivity proof is
      // left to Playwright/Python demos; this smoke validates API plumbing.
    });
    clearTimeout(timer);
    return {
      event_type: res.ok ? 'success' : 'http_error',
      status_code: res.status,
      skipped: true,
      note: 'node_fetch_no_proxy_agent',
    };
  } catch (err) {
    return {
      event_type:
        String(err?.message ?? '').toLowerCase().includes('timeout') ||
        err?.name === 'AbortError'
          ? 'timeout'
          : 'http_error',
      status_code: 0,
      error_message: String(err?.message ?? err).slice(0, 300),
      skipped: true,
    };
  }
}

async function run() {
  log('config', {
    base_url: BASE_URL,
    allow_paid: ALLOW_PAID,
    register: SHOULD_REGISTER,
  });

  if (SHOULD_REGISTER) {
    await register();
  }
  if (!apiKey) {
    throw new Error('NEXALAYER_API_KEY is required when registration is off');
  }

  const info = await api('GET', '/account/info');
  log('account.info', {
    agent_id: info.agent_id,
    backend_ready: info.backend_ready,
    active_sessions: info.active_sessions,
    max_active_sessions: info.max_active_sessions,
  });

  const productNo = await pickDynamicProduct();
  const balanceBefore = await api('GET', '/billing/balance');
  log('billing.balance.before', {
    balance: balanceBefore.balance,
    trial_balance: balanceBefore.trial?.trial_balance,
  });

  if (!ALLOW_PAID) {
    const tx = await api('GET', '/billing/transactions?page=1&page_size=5');
    log('billing.transactions.safe', {
      total: tx.pagination?.total ?? tx.total ?? tx.items?.length ?? 0,
    });
    log('phase0.result', {
      mode: 'safe',
      completed_until: 'register_api_key_products_balance_transactions',
      next: 'set PHASE0_ALLOW_PAID=1 to create a low-volume dynamic session',
    });
    return;
  }

  const idempotencyKey = `phase0-${Date.now()}`;
  const created = await api(
    'POST',
    '/sessions',
    {
      session_type: 'dynamic',
      product_no: productNo,
      quantity: Number(process.env.PHASE0_QUANTITY ?? 1),
      protocol: process.env.PHASE0_PROTOCOL ?? 'socks5',
      rotation_mode: 'on_demand',
    },
    { 'Idempotency-Key': idempotencyKey }
  );
  sessionId = created.session_id;
  log('session.create', {
    session_id: sessionId,
    status: created.status,
    product_no: productNo,
  });

  const active = await waitForActive(sessionId);
  log('session.active', {
    session_id: sessionId,
    proxy: maskProxy(active.proxy),
  });
  if (!active.proxy?.full_url) {
    throw new Error('Active session did not return proxy.full_url');
  }

  const event = await tryProxy(active.proxy.full_url);
  const report = await api(
    'POST',
    `/sessions/${sessionId}/report-event`,
    {
      event_type: event.event_type,
      status_code: event.status_code,
      target_host: 'httpbin.org',
      error_message: event.error_message,
      metadata: { phase0: true, skipped_proxy_connectivity: event.skipped },
    }
  );
  log('telemetry.report', report);

  const health = await api('GET', `/sessions/${sessionId}/health`);
  log('session.health', {
    health_score: health.health_score,
    risk_level: health.risk_level,
    success_rate: health.success_rate,
    consecutive_failures: health.consecutive_failures,
    recommendation: health.recommendation,
  });

  const balanceAfter = await api('GET', '/billing/balance');
  log('billing.balance.after', {
    balance: balanceAfter.balance,
  });
  const tx = await api('GET', '/billing/transactions?page=1&page_size=5');
  log('billing.transactions.after', {
    total: tx.pagination?.total ?? tx.total ?? tx.items?.length ?? 0,
  });
}

try {
  await run();
} finally {
  if (sessionId) {
    try {
      const terminated = await api('DELETE', `/sessions/${sessionId}`);
      log('session.cleanup', {
        session_id: sessionId,
        status: terminated.status,
      });
    } catch (err) {
      log('session.cleanup_failed', {
        session_id: sessionId,
        error: err.message,
      });
      process.exitCode = 1;
    }
  }
}
