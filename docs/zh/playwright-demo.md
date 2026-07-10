# Playwright 中文 Demo

这个 Demo 展示如何让 Playwright 使用 NexaLayer Session，而不是直接管理一堆代理 IP。

核心流程：

```text
创建 dynamic Session
  -> 等待 active
  -> 读取 proxy.full_url / host / port / username / password
  -> 转成 Playwright proxy 配置
  -> 执行浏览器任务
  -> 上报 telemetry
  -> 查询 health recommendation
  -> terminate Session
```

## 运行示例

```bash
cd examples/playwright-zh
npm install

export NEXALAYER_BASE_URL=https://api.nexalayer.net/v1
export NEXALAYER_API_KEY=agk_your_key
npm start
```

没有 API Key 时，可以注册一个测试 Agent：

```bash
export NEXALAYER_REGISTER=1
export NEXALAYER_AGENT_NAME=playwright-zh-demo
npm start
```

如果要指定产品：

```bash
export NEXALAYER_PRODUCT_NO=dynamic_ipweb
npm start
```

如果要访问自己的测试页面：

```bash
export NEXALAYER_TARGET_URL=https://example.com
npm start
```

## 关键代码

创建 Session：

```js
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
```

轮询到 `active`：

```js
const session = await waitForActive(created.session_id);
console.log("proxy.full_url:", session.proxy?.full_url);
```

转成 Playwright proxy：

```js
function toPlaywrightProxy(proxy) {
  return {
    server: `${proxy.protocol ?? "socks5"}://${proxy.host}:${proxy.port}`,
    username: proxy.username ?? undefined,
    password: proxy.password ?? undefined,
  };
}
```

启动浏览器：

```js
const browser = await chromium.launch({
  headless: true,
  proxy: toPlaywrightProxy(session.proxy),
});
```

上报结果：

```js
await api("POST", `/sessions/${sessionId}/report-event`, {
  event_type: "success",
  status_code: 200,
  target_host: "httpbin.org",
});
```

查询建议：

```js
const health = await api("GET", `/sessions/${sessionId}/health`);
console.log(health.recommendation);
```

清理 Session：

```js
await api("DELETE", `/sessions/${sessionId}`);
```

## 为什么不要直接把 full_url 塞给 Playwright？

NexaLayer 返回 `proxy.full_url` 是为了方便 curl、Python requests、HTTP 客户端等工具直接使用：

```text
socks5://user:pass@host:port
```

Playwright 更推荐拆成：

```js
{
  server: "socks5://host:port",
  username: "user",
  password: "pass"
}
```

所以示例里保留 `proxy.full_url` 打印用于排查，同时实际启动浏览器时使用 `host / port / username / password`。

## Telemetry 事件怎么选？

| Playwright 结果 | event_type |
| --- | --- |
| 页面正常打开，状态码 2xx/3xx | `success` |
| 页面返回 403/500 等错误 | `http_error` |
| `page.goto` 超时 | `timeout` |
| 页面出现验证码 | `captcha` |
| 明确被封禁或访问被拒 | `block` |
| 429 或频控 | `rate_limit` |

这些事件会上报到 Session，NexaLayer 会更新：

- `health_score`
- `risk_level`
- `success_rate`
- `consecutive_failures`
- `recommendation`

## 什么时候 rotate？

Dynamic Session 支持 rotate：

```bash
curl -X POST "$BASE_URL/sessions/$SID/rotate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEXALAYER_API_KEY" \
  -H "Idempotency-Key: rotate-001" \
  -d '{ "reason": "http_403" }'
```

建议策略：

| recommendation | Playwright 侧动作 |
| --- | --- |
| `ok` | 继续使用 |
| `consider_rotate` | 下一个任务前考虑 rotate |
| `rotate_now` | 立即 rotate，然后重试任务 |
| `pause` | 暂停任务，检查账号、目标站点、频率和验证码情况 |

## 静态 Session 可以用于 Playwright 吗？

可以。静态 Session 同样会返回 `proxy` 对象，Playwright 接入方式相同。

区别是：

- Dynamic Session 适合失败后按原因 rotate。
- Static Session 适合固定账号、固定地区、长期保活。
- Static Session 不支持 rotate；需要续费、终止或重新创建。

## 安全提醒

示例会打印 `proxy.full_url`，其中包含代理账号密码。调试时可以打印，生产日志里建议脱敏。

测试结束后一定要 terminate Session。示例的 `finally` 已经做了这件事。
