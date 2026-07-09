import { chromium } from "playwright";

const BASE_URL =
  process.env.NEXALAYER_BASE_URL ?? "https://api.nexalayer.net/v1";
const API_KEY = process.env.NEXALAYER_API_KEY;
const PRODUCT_NO = process.env.NEXALAYER_PRODUCT_NO ?? "out_dynamic_1";

if (!API_KEY) {
  throw new Error("NEXALAYER_API_KEY is required");
}

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
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

async function waitForActive(sessionId) {
  for (let i = 0; i < 30; i += 1) {
    const session = await api("GET", `/sessions/${sessionId}`);
    if (session.status === "active") return session;
    if (session.status === "error") {
      throw new Error(`Session failed: ${JSON.stringify(session.health)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Session did not become active within 60s");
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

const created = await api(
  "POST",
  "/sessions",
  {
    session_type: "dynamic",
    product_no: PRODUCT_NO,
    quantity: 1,
    protocol: "socks5",
    rotation_mode: "on_demand",
  },
  { "Idempotency-Key": `playwright-${Date.now()}` },
);

const session = await waitForActive(created.session_id);
console.log("proxy.full_url:", session.proxy?.full_url);

const browser = await chromium.launch({
  headless: true,
  proxy: toPlaywrightProxy(session.proxy),
});

let event = {
  event_type: "success",
  status_code: 200,
  target_host: "httpbin.org",
};

try {
  const page = await browser.newPage();
  await page.goto("https://httpbin.org/ip", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  console.log(await page.textContent("body"));
} catch (error) {
  event = {
    event_type:
      error?.message?.toLowerCase().includes("timeout")
        ? "timeout"
        : "http_error",
    status_code: 0,
    target_host: "httpbin.org",
    error_message: String(error?.message ?? error).slice(0, 500),
  };
  throw error;
} finally {
  await api(
    "POST",
    `/sessions/${created.session_id}/report-event`,
    event,
  ).catch(() => {});
  await browser.close().catch(() => {});
}

const health = await api(
  "GET",
  `/sessions/${created.session_id}/health`,
);
console.log("recommendation:", health.recommendation);
