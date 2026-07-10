# NexaLayer Playwright 中文 Demo

这个示例演示一个最小 Playwright 自动化任务如何接入 NexaLayer：

1. 使用已有 API Key，或注册一个测试 Agent。
2. 查询 dynamic 产品并自动选择一个可用产品。
3. 创建 dynamic Session。
4. 轮询到 `active`。
5. 把 Session 返回的 `host / port / username / password` 转成 Playwright proxy 配置。
6. 打开 `https://httpbin.org/ip`。
7. 上报 `success` / `http_error` / `timeout`。
8. 查询 health recommendation。
9. 终止 Session，避免测试资源残留。

## 运行

```bash
cd examples/playwright-zh
npm install

export NEXALAYER_BASE_URL=https://api.nexalayer.net/v1
export NEXALAYER_API_KEY=agk_your_key
npm start
```

如果你还没有 API Key，可以让示例注册一个测试 Agent：

```bash
export NEXALAYER_REGISTER=1
export NEXALAYER_AGENT_NAME=playwright-zh-demo
npm start
```

注册响应里必须看到 `backend_ready=true`，否则不要继续创建 Session。

## 可选配置

```bash
export NEXALAYER_PRODUCT_NO=dynamic_ipweb
export NEXALAYER_TARGET_URL=https://httpbin.org/ip
```

如果不设置 `NEXALAYER_PRODUCT_NO`，示例会从 `/products?type=dynamic` 里自动选择一个产品。

## Playwright proxy 重点

NexaLayer 返回：

```json
{
  "proxy": {
    "host": "proxy.example.com",
    "port": 1080,
    "username": "user",
    "password": "pass",
    "protocol": "socks5",
    "full_url": "socks5://user:pass@proxy.example.com:1080"
  }
}
```

Playwright 需要的格式是：

```js
{
  server: "socks5://proxy.example.com:1080",
  username: "user",
  password: "pass"
}
```

示例里的 `toPlaywrightProxy()` 已经完成这个转换。

## 常见失败处理

- `backend_ready=false`：后端账号还没有同步完成，不能创建 Session。
- `Session failed`：查看 `health.last_error_type`，通常是余额、产品、库存或后端开通问题。
- `timeout`：示例会上报 `timeout`，NexaLayer 会把它计入健康评分和连续失败次数。
- `recommendation=rotate_now`：dynamic Session 可以调用 `POST /sessions/:id/rotate` 并带上原因，例如 `timeout`、`http_403`、`captcha`。
