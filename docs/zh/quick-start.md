# 中文 Quick Start

这份 Quick Start 面向第一次接入 NexaLayer 的中国开发者。目标是在 5 分钟内理解并跑通：

```text
API Key -> 产品列表 -> 创建 Session -> 获取代理 URL -> 上报结果 -> 获取轮换建议 -> 清理 Session
```

## 1. 获取或使用已有 API Key

如果你已经有 API Key，直接跳到下一步。

```bash
BASE_URL="https://api.nexalayer.net/v1"

curl -X POST "$BASE_URL/account/request-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com"
  }'
```

API Key 会发送到邮箱，响应重点看 `backend_ready`：

```json
{
  "data": {
    "status": "email_sent",
    "balance": 0,
    "backend_ready": true
  }
}
```

`backend_ready` 必须是 `true` 才能创建 Session。如果返回 `false`，说明后端账号同步失败或尚未完成，不要继续开通类操作。

之后所有请求都带：

```bash
export NEXALAYER_API_KEY="agk_xxx"
```

你可以自行充值后直接使用。如需试用，请联系 Telegram 售后
support@nexalayer.net（备用 Telegram @LEWISMIN），由售后为对应邮箱账号配置资源。

## 2. 查询产品

查询动态代理产品：

```bash
curl "$BASE_URL/products?type=dynamic" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

查询静态代理产品：

```bash
curl "$BASE_URL/products?type=static" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

产品响应里的 `product_no` 用于创建 Session。

静态共享产品可能包含：

```json
{
  "product_no": "ZT_US_Englewood_5",
  "type": "static",
  "project_required": true,
  "projects": [
    { "code": "game", "name": "游戏业务", "inventory": 10 }
  ]
}
```

如果 `project_required=true`，创建 static Session 时可以传 `project_id`。如果不传，NexaLayer 会尝试自动选择一个有库存的项目。

## 3. 创建 Dynamic Session

Dynamic Session 适合批量任务、数据采集、短周期浏览器自动化和需要按失败原因轮换的任务。

```bash
PRODUCT_NO="dynamic_ipweb"

curl -X POST "$BASE_URL/sessions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEXALAYER_API_KEY" \
  -H "Idempotency-Key: create-dynamic-001" \
  -d "{
    \"session_type\": \"dynamic\",
    \"product_no\": \"$PRODUCT_NO\",
    \"quantity\": 1,
    \"protocol\": \"socks5\",
    \"rotation_mode\": \"on_demand\"
  }"
```

创建接口是异步的。成功受理后会返回：

```json
{
  "data": {
    "session_id": "sess_xxx",
    "status": "creating"
  }
}
```

## 4. 轮询 Session 到 active

```bash
SID="sess_xxx"

curl "$BASE_URL/sessions/$SID" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

当 `status=active` 时，会返回代理信息：

```json
{
  "data": {
    "session_id": "sess_xxx",
    "status": "active",
    "proxy": {
      "host": "host1.ztproxy.net",
      "port": 6666,
      "username": "user",
      "password": "pass",
      "protocol": "socks5",
      "full_url": "socks5://user:pass@host1.ztproxy.net:6666"
    }
  }
}
```

`proxy.full_url` 可以直接给 Python requests、curl 或其他支持代理 URL 的工具使用。Playwright 通常需要拆成 `server + username + password`，见 [Playwright 中文 Demo](./playwright-demo.md)。

## 5. Python 最小示例

仓库里已有可运行示例：

```bash
cd examples/python-quickstart
python3 -m venv .venv
. .venv/bin/activate
pip install requests

export NEXALAYER_BASE_URL=https://api.nexalayer.net/v1
export NEXALAYER_API_KEY=agk_your_key
export NEXALAYER_PRODUCT_NO=dynamic_ipweb
python main.py
```

没有 API Key 时，也可以让示例注册一个测试 Agent：

```bash
export NEXALAYER_REGISTER=1
export NEXALAYER_AGENT_NAME=quickstart-demo
python main.py
```

## 6. 上报执行结果

自动化任务完成后，把结果上报给 Session：

```bash
curl -X POST "$BASE_URL/sessions/$SID/report-event" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEXALAYER_API_KEY" \
  -d '{
    "event_type": "success",
    "status_code": 200,
    "target_host": "example.com",
    "latency_ms": 1200
  }'
```

常用事件：

| event_type | 含义 |
| --- | --- |
| `success` | 访问成功 |
| `http_error` | HTTP 错误，例如 403/500 |
| `captcha` | 遇到验证码 |
| `timeout` | 请求或页面加载超时 |
| `block` | 明确被风控/封禁 |
| `rate_limit` | 429 或频控 |

这些事件会影响 `health_score`、`risk_level`、`success_rate`、`consecutive_failures` 和 `recommendation`。

## 7. 查询健康和轮换建议

```bash
curl "$BASE_URL/sessions/$SID/health" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

典型响应：

```json
{
  "data": {
    "health_score": 100,
    "risk_level": "low",
    "success_rate": 1,
    "consecutive_failures": 0,
    "recommendation": "ok"
  }
}
```

`recommendation` 的含义：

| recommendation | 建议 |
| --- | --- |
| `ok` | 继续使用当前 Session |
| `consider_rotate` | 可以考虑轮换，适合低风险失败 |
| `rotate_now` | 建议立即轮换 |
| `pause` | 建议暂停任务，可能存在高风险或连续失败 |

## 8. Dynamic Session 轮换

当遇到 403、429、验证码、超时或封禁，可以带原因轮换：

```bash
curl -X POST "$BASE_URL/sessions/$SID/rotate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEXALAYER_API_KEY" \
  -H "Idempotency-Key: rotate-timeout-001" \
  -d '{
    "reason": "timeout"
  }'
```

支持的 reason：

```text
manual, scheduled, http_403, http_429, captcha, timeout, block
```

Static Session 不支持 rotate；静态 IP 场景应续费、终止或重新创建。

## 9. 创建 Static Session

Static Session 适合账号登录保活、长期运营、多地区固定身份、广告验证等场景。

```bash
STATIC_PRODUCT_NO="ZT_US_Englewood_5"

curl -X POST "$BASE_URL/sessions" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEXALAYER_API_KEY" \
  -H "Idempotency-Key: create-static-001" \
  -d "{
    \"session_type\": \"static\",
    \"product_no\": \"$STATIC_PRODUCT_NO\",
    \"quantity\": 1,
    \"duration\": 30,
    \"protocol\": \"socks5\",
    \"rotation_mode\": \"fixed\"
  }"
```

如果你想指定共享静态项目：

```json
{
  "session_type": "static",
  "product_no": "ZT_US_Englewood_5",
  "project_id": "game",
  "quantity": 1,
  "duration": 30,
  "protocol": "socks5",
  "rotation_mode": "fixed"
}
```

## 10. 查询余额和交易

```bash
curl "$BASE_URL/billing/balance" \
  -H "X-API-Key: $NEXALAYER_API_KEY"

curl "$BASE_URL/billing/transactions?page=1&page_size=20" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

## 11. 终止 Session

测试完成后务必清理：

```bash
curl -X DELETE "$BASE_URL/sessions/$SID" \
  -H "X-API-Key: $NEXALAYER_API_KEY"
```

Dynamic Session 会终止本地 Session。Static Session 会调用后端释放流程，并将本地 Session 标记为 terminated。

## 什么时候用 Dynamic，什么时候用 Static？

| 场景 | 建议 |
| --- | --- |
| 批量数据采集、短任务、多目标站点 | Dynamic Session |
| 账号登录、长期保活、固定地区身份 | Static Session |
| 403/429/CAPTCHA 后需要按原因轮换 | Dynamic Session |
| 一个账号长期绑定一个网络身份 | Static Session |
| AI Agent 浏览网页经常被登录/验证码打断 | 先用 Session，按 telemetry 决定是否 rotate |

NexaLayer 的目标不是让你“多买一点代理”，而是让自动化任务知道当前 Session 是否健康、为什么失败、什么时候该换、换完是否更好。
