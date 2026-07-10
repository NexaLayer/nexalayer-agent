import { chromium } from "playwright";

const BASE_URL =
  process.env.NEXALAYER_BASE_URL ?? "https://api.nexalayer.net/v1";
let apiKey = process.env.NEXALAYER_API_KEY;
const PRODUCT_NO = process.env.NEXALAYER_PRODUCT_NO;
const TARGET_URL =
  process.env.NEXALAYER_TARGET_URL ?? "https://httpbin.org/ip";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(JSON.stringify(json.error ?? json));
  }
  return json.data;
}

async function registerAgent() {
  const name =
    process.env.NEXALAYER_AGENT_NAME ??
    `playwright-${Date.now().toString(36)}`;
  const data = await api("POST", "/account/register", {
    name,
    contact_email: `${name}@example.com`,
  });
  if (!data.backend_ready) {
    throw new Error(
      `Agent registered but backend is not ready: ${
        data.backend_sync_error ?? "unknown"
      }`,
    );
  }
  console.log("api_key:", data.api_key);
  apiKey = data.api_key;
}

async function pickDynamicProduct() {
  if (PRODUCT_NO) return PRODUCT_NO;
  const products = await api("GET", "/products?type=dynamic");
  const candidate = [...(products.items ?? [])]
    .filter((item) => item.product_no)
    .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))[0];
  if (!candidate) {
    throw new Error("No dynamic product available");
  }
  console.log("selected_product:", candidate.product_no);
  return candidate.product_no;
}

async function waitForActive(sessionId) {
  for (let i = 0; i < 60; i += 1) {
    const session = await api("GET", `/sessions/${sessionId}`);
    if (session.status === "active") return session;
    if (session.status === "error") {
      throw new Error(`Session failed: ${JSON.stringify(session.health)}`);
    }
    await sleep(2000);
  }
  throw new Error("Session did not become active within 120s");
}

function toPlaywrightProxy(proxy) {
  if (!proxy?.host || !proxy?.port) {
    throw new Error("Session proxy is missing host/port");
  }
  return {
    server: `${proxy.protocol ?? "socks5"}://${proxy.host}:${proxy.port}`,
    username: proxy.username ?? undefined,
    password: proxy.password ?? undefined,
  };
}

if (!apiKey && process.env.NEXALAYER_REGISTER === "1") {
  await registerAgent();
}
if (!apiKey) {
  throw new Error("Set NEXALAYER_API_KEY or NEXALAYER_REGISTER=1");
}

const productNo = await pickDynamicProduct();
let sessionId;
let browser;
let event = {
  event_type: "success",
  status_code: 200,
  target_host: new URL(TARGET_URL).hostname,
};

try {
  const created = await api(
    "POST",
    "/sessions",
    {
      session_type: "dynamic",
      product_no: productNo,
      quantity: 1,
      protocol: "socks5",
      rotation_mode: "on_demand",
    },
    { "Idempotency-Key": `playwright-${Date.now()}` },
  );
  sessionId = created.session_id;
  console.log("session_id:", sessionId);

  const session = await waitForActive(sessionId);
  console.log("proxy.full_url:", session.proxy?.full_url);

  browser = await chromium.launch({
    headless: true,
    proxy: toPlaywrightProxy(session.proxy),
  });

  const page = await browser.newPage();
  const response = await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  event.status_code = response?.status() ?? 0;
  event.event_type = response?.ok() ? "success" : "http_error";
  console.log(await page.textContent("body"));
} catch (error) {
  event = {
    event_type:
      error?.message?.toLowerCase().includes("timeout")
        ? "timeout"
        : "http_error",
    status_code: 0,
    target_host: new URL(TARGET_URL).hostname,
    error_message: String(error?.message ?? error).slice(0, 500),
  };
  throw error;
} finally {
  if (sessionId) {
    await api("POST", `/sessions/${sessionId}/report-event`, event).catch(
      () => {},
    );
  }
  await browser?.close().catch(() => {});
  if (sessionId) {
    const health = await api("GET", `/sessions/${sessionId}/health`).catch(
      () => null,
    );
    if (health) {
      console.log("recommendation:", health.recommendation);
    }
    await api("DELETE", `/sessions/${sessionId}`).catch(() => {});
  }
}
