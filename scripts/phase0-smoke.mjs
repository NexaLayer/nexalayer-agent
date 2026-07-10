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
const SESSION_TYPE =
  process.env.PHASE0_SESSION_TYPE ?? 'dynamic';
const STATIC_ZT_ONLY =
  process.env.PHASE0_STATIC_ZT_ONLY !== '0';
const SESSION_TIMEOUT_MS = Number(
  process.env.PHASE0_SESSION_TIMEOUT_MS ?? 90_000
);
const POLL_MS = Number(process.env.PHASE0_POLL_MS ?? 3_000);
const REQUEST_TIMEOUT_MS = Number(
  process.env.PHASE0_REQUEST_TIMEOUT_MS ?? 60_000
);
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;
const BACKEND_AGENT_USERNAME =
  process.env.BACKEND_AGENT_USERNAME;
const BACKEND_AGENT_PASSWORD =
  process.env.BACKEND_AGENT_PASSWORD;
const BACKEND_ADMIN_USERNAME =
  process.env.BACKEND_ADMIN_USERNAME;
const BACKEND_ADMIN_PASSWORD =
  process.env.BACKEND_ADMIN_PASSWORD;
const TOPUP_CNY = Number(
  process.env.PHASE0_TOPUP_CNY ??
    (ALLOW_PAID &&
    BACKEND_BASE_URL &&
    (BACKEND_AGENT_USERNAME || BACKEND_ADMIN_USERNAME)
      ? SESSION_TYPE === 'static'
        ? 40
        : 20
      : 0)
);

let apiKey = process.env.NEXALAYER_API_KEY ?? '';
let sessionId = '';
let registeredAgentName = '';
let registeredAgentId = 0;
let backendUsername = '';
let backendUserId = 0;
let backendToken = '';
let backendLoginRole = '';

function log(label, data) {
  console.log(JSON.stringify({ label, ...data }));
}

async function api(method, path, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );
  const requestHeaders = {
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...headers,
  };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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
  registeredAgentName = name;
  registeredAgentId = data.agent_id;
  backendUsername = generateBackendUsername(name, data.agent_id);
  log('register', {
    agent_id: data.agent_id,
    backend_ready: data.backend_ready,
    backend_username: backendUsername,
    trial_balance: data.trial?.trial_balance,
    has_api_key: Boolean(apiKey),
  });
  if (!data.backend_ready) {
    throw new Error(
      `backend_ready=false: ${data.backend_sync_error ?? 'unknown'}`
    );
  }
}

function generateBackendUsername(agentName, agentId) {
  const cleaned = agentName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 8);
  return `ag_${cleaned}${agentId}`;
}

async function backendApi(method, path, body) {
  if (!BACKEND_BASE_URL) {
    throw new Error('BACKEND_BASE_URL is required for backend top-up');
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );
  const headers = {};
  if (backendToken) {
    headers.Authorization = `Bearer ${backendToken}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok || (typeof json?.code === 'number' && json.code !== 0)) {
    throw new Error(
      `${method} ${path} failed: HTTP ${res.status} ` +
        `${json?.msg ?? json?.message ?? ''}`
    );
  }
  return json?.data;
}

async function ensureBackendToken() {
  if (backendToken) return backendToken;
  const candidates = [
    {
      role: 'agent',
      username: BACKEND_AGENT_USERNAME,
      password: BACKEND_AGENT_PASSWORD,
    },
    {
      role: 'admin',
      username: BACKEND_ADMIN_USERNAME,
      password: BACKEND_ADMIN_PASSWORD,
    },
  ].filter((c) => c.username && c.password);
  if (!candidates.length) {
    throw new Error(
      'Backend top-up requires BACKEND_AGENT_USERNAME/PASSWORD or BACKEND_ADMIN_USERNAME/PASSWORD'
    );
  }
  let lastError;
  for (const c of candidates) {
    try {
      const data = await backendApi('POST', '/api/auth/login', {
        username: c.username,
        password: c.password,
      });
      backendToken = data.token;
      backendLoginRole = c.role;
      log('backend.login', { role: c.role, ok: true });
      return backendToken;
    } catch (err) {
      lastError = err;
      log('backend.login', { role: c.role, ok: false });
    }
  }
  throw lastError;
}

async function findBackendUser() {
  if (backendUserId) return backendUserId;
  await ensureBackendToken();
  const qs =
    backendLoginRole === 'admin'
      ? new URLSearchParams({
          page: '1',
          pageSize: '5',
          search: backendUsername,
        })
      : new URLSearchParams({
          page: '1',
          pageSize: '5',
          search: backendUsername,
        });
  const path =
    backendLoginRole === 'admin'
      ? `/api/open/app/users/list?${qs}`
      : `/api/open/app/agent/sub-users?${qs}`;
  const data = await backendApi('GET', path);
  const users = data?.items ?? data?.list ?? [];
  const match =
    users.find((u) => u.username === backendUsername) ?? users[0];
  if (!match?.id) {
    throw new Error(`Backend user not found: ${backendUsername}`);
  }
  backendUserId = match.id;
  return backendUserId;
}

async function adjustBackendBalance(amount, remark) {
  if (!amount) return null;
  await ensureBackendToken();
  const id = await findBackendUser();
  const path =
    backendLoginRole === 'admin'
      ? `/api/open/app/user/${id}/balance`
      : `/api/open/app/agent/sub-users/${id}/balance`;
  return backendApi('POST', path, { amount, remark });
}

async function cleanupBackendBalance() {
  if (!backendUserId || !backendToken) return;
  const qs = new URLSearchParams({
    page: '1',
    pageSize: '5',
    search: backendUsername,
  });
  const path =
    backendLoginRole === 'admin'
      ? `/api/open/app/users/list?${qs}`
      : `/api/open/app/agent/sub-users?${qs}`;
  const data = await backendApi('GET', path);
  const users = data?.items ?? data?.list ?? [];
  const match =
    users.find((u) => u.id === backendUserId) ?? users[0];
  const balance = Number(match?.balance ?? 0);
  if (balance > 0) {
    await adjustBackendBalance(
      -balance,
      'phase0 cleanup: remove remaining test balance'
    );
    log('backend.balance.cleanup', {
      backend_user_id: backendUserId,
      removed_balance: balance,
    });
  }
}

async function pickProduct(sessionType) {
  const data = await api('GET', `/products?type=${sessionType}`);
  const items = data.items ?? [];
  log(`products.${sessionType}`, {
    total: data.total ?? items.length,
    sample: items.slice(0, 3).map((p) => ({
      product_no: p.product_no,
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      project_required: p.project_required,
    })),
  });
  const configured =
    process.env.PHASE0_PRODUCT_NO ??
    process.env.NEXALAYER_PRODUCT_NO;
  if (configured) return configured;

  let candidates = items.filter((p) => p.product_no);
  if (sessionType === 'static') {
    candidates = candidates.filter((p) => Number(p.stock ?? 0) > 0);
    if (STATIC_ZT_ONLY) {
      candidates = candidates.filter((p) =>
        String(p.product_no).startsWith('ZT_')
      );
    }
  }
  const sorted = candidates.sort(
    (a, b) => Number(a.price ?? 0) - Number(b.price ?? 0)
  );
  if (!sorted.length) {
    throw new Error(
      `No ${sessionType}${sessionType === 'static' && STATIC_ZT_ONLY ? ' ZT_' : ''} product available`
    );
  }
  log('products.selected', {
    session_type: sessionType,
    product_no: sorted[0].product_no,
    price: sorted[0].price,
    stock: sorted[0].stock,
    project_required: sorted[0].project_required,
  });
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
  if (!['dynamic', 'static'].includes(SESSION_TYPE)) {
    throw new Error(
      `Unsupported PHASE0_SESSION_TYPE: ${SESSION_TYPE}`
    );
  }

  log('config', {
    base_url: BASE_URL,
    allow_paid: ALLOW_PAID,
    register: SHOULD_REGISTER,
    session_type: SESSION_TYPE,
    static_zt_only: SESSION_TYPE === 'static' ? STATIC_ZT_ONLY : undefined,
    topup_cny: TOPUP_CNY,
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

  const productNo = await pickProduct(SESSION_TYPE);
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
      next: `set PHASE0_ALLOW_PAID=1 to create a low-volume ${SESSION_TYPE} session`,
    });
    return;
  }

  if (TOPUP_CNY > 0) {
    const adjusted = await adjustBackendBalance(
      TOPUP_CNY,
      'phase0 real smoke top-up'
    );
    log('backend.balance.topup', {
      backend_user_id: backendUserId,
      amount: TOPUP_CNY,
      balance: adjusted?.balance,
    });
  }

  const idempotencyKey = `phase0-${Date.now()}`;
  const createBody = {
    session_type: SESSION_TYPE,
    product_no: productNo,
    quantity: Number(process.env.PHASE0_QUANTITY ?? 1),
    protocol: process.env.PHASE0_PROTOCOL ?? 'socks5',
    rotation_mode:
      SESSION_TYPE === 'dynamic' ? 'on_demand' : 'fixed',
  };
  if (SESSION_TYPE === 'static') {
    createBody.duration = Number(
      process.env.PHASE0_STATIC_DURATION ?? 30
    );
    if (process.env.PHASE0_PROJECT_ID) {
      createBody.project_id = process.env.PHASE0_PROJECT_ID;
    }
  }
  const created = await api(
    'POST',
    '/sessions',
    createBody,
    { 'Idempotency-Key': idempotencyKey }
  );
  sessionId = created.session_id;
  log('session.create', {
    session_id: sessionId,
    session_type: SESSION_TYPE,
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
  try {
    await cleanupBackendBalance();
  } catch (err) {
    log('backend.balance.cleanup_failed', {
      backend_user_id: backendUserId || undefined,
      error: err.message,
    });
    process.exitCode = 1;
  }
}
