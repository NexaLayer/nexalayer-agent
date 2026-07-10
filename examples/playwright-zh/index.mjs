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
    `playwright-zh-${Date.now().toString(36)}`;
  const data = await api("POST", "/account/register", {
    name,
    contact_email: `${name}@example.com`,
  });
  console.log("注册完成:", {
    agent_id: data.agent_id,
    backend_ready: data.backend_ready,
    trial_balance: data.trial?.trial_balance,
  });
  if (!data.backend_ready) {
    throw new Error(
      `后端账号尚未同步，不能创建 Session: ${
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
    throw new Error("没有可用的 dynamic 产品");
  }
  console.log("自动选择产品:", {
    product_no: candidate.product_no,
    price: candidate.price,
    unit: candidate.unit,
  });
  return candidate.product_no;
}

async function waitForActive(sessionId) {
  for (let i = 0; i < 60; i += 1) {
    const session = await api("GET", `/sessions/${sessionId}`);
    console.log("Session 状态:", session.status);
    if (session.status === "active") return session;
    if (session.status === "error") {
      throw new Error(`Session 创建失败: ${JSON.stringify(session.health)}`);
    }
    await sleep(2000);
  }
  throw new Error("Session 120 秒内没有变为 active");
}

function toPlaywrightProxy(proxy) {
  if (!proxy?.host || !proxy?.port) {
    throw new Error("Session proxy 缺少 host/port");
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
  throw new Error("请设置 NEXALAYER_API_KEY，或设置 NEXALAYER_REGISTER=1");
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
    { "Idempotency-Key": `playwright-zh-${Date.now()}` },
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
  console.log("页面响应:", await page.textContent("body"));
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
      console.log("健康状态:", {
        health_score: health.health_score,
        risk_level: health.risk_level,
        success_rate: health.success_rate,
        consecutive_failures: health.consecutive_failures,
        recommendation: health.recommendation,
      });
    }
    await api("DELETE", `/sessions/${sessionId}`).catch(() => {});
    console.log("Session 已终止:", sessionId);
  }
}
