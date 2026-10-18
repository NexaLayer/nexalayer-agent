# AI Agent 网络执行层 — 用户使用手册

> **版本**: v2.0  
> **日期**: 2026-03-08  
> **适用对象**: AI Agent 开发者、集成工程师
>
> **v2.0 变更**: 新增指纹浏览器配置管理（Profile）、
> 浏览器实例管理、自动化引擎、任务队列、反检测、MCP 接口
>
> **v1.1 变更**: 新增纯 API Key 认证模式、
> 试用模式、Telemetry 上报、Session 异步创建、
> 智能轮换策略

---

## 目录

1. [快速开始](#1-快速开始)
2. [认证指南](#2-认证指南)
3. [账户管理](#3-账户管理)
4. [余额与充值](#4-余额与充值)
5. [代理产品](#5-代理产品)
6. [Session 管理（核心）](#6-session-管理核心)
7. [遥测上报（Telemetry）](#7-遥测上报telemetry)
8. [统计与查询](#8-统计与查询)
9. [Webhook 事件](#9-webhook-事件)
10. [错误处理](#10-错误处理)
11. [最佳实践](#11-最佳实践)
12. [SDK 使用示例](#12-sdk-使用示例)
13. [指纹浏览器配置管理（Phase 2）](#13-指纹浏览器配置管理phase-2)
14. [浏览器实例与自动化（Phase 3）](#14-浏览器实例与自动化phase-3)
15. [浏览器任务队列（Phase 3）](#15-浏览器任务队列phase-3)
16. [反检测引擎（Phase 3）](#16-反检测引擎phase-3)
17. [MCP 接口（Phase 3）](#17-mcp-接口phase-3)
18. [FAQ](#18-faq)

---

## 1. 快速开始

### 1.1 3 分钟入门

只需 3 步，即可让您的 AI Agent 使用代理 IP：

```
Step 1: 注册 → 获取 API Key
Step 2: 创建 Session → 等待就绪
Step 3: 使用代理 IP 发送请求
```

> 💡 你可以自行充值后直接使用。如需试用，请联系
> 售后邮箱 support@nexalayer.net（备用 Telegram @LEWISMIN），由售后为对应邮箱账号配置资源。

### 1.2 快速示例（Python）

```python
import requests
import time

BASE_URL = "https://api.nexalayer.net/v1"

# Step 1: 注册（仅需一次）
resp = requests.post(
    f"{BASE_URL}/account/register", 
    json={
        "name": "My AI Agent",
        "contact_email": "dev@example.com"
    }
)
credentials = resp.json()["data"]
api_key = credentials["api_key"]
# ⚠️ 请保存好 api_key，后续所有请求都需要！

# 所有后续请求只需这一个 Header
headers = {"X-API-Key": api_key}

# Step 2: 创建动态代理 Session（异步）
resp = requests.post(
    f"{BASE_URL}/sessions", 
    json={
        "type": "dynamic",
        "config": {
            "product_no": "out_dynamic_1",
            "traffic_gb": 1,
            "protocol": "http",
            "country": "US"
        }
    }, 
    headers=headers
)
session = resp.json()["data"]
session_id = session["session_id"]
# status 初始为 "creating"

# 等待 Session 就绪
while True:
    resp = requests.get(
        f"{BASE_URL}/sessions/{session_id}",
        headers=headers
    )
    data = resp.json()["data"]
    if data["status"] == "active":
        proxy_url = data["proxy"]["full_url"]
        break
    time.sleep(2)  # 轮询间隔 2 秒

# Step 3: 通过代理发送请求
proxies = {"http": proxy_url, "https": proxy_url}
resp = requests.get(
    "https://httpbin.org/ip", proxies=proxies
)
print(resp.json())
# {"origin": "xxx.xxx.xxx.xxx"}  ← 代理 IP
```

### 1.3 快速示例（Node.js）

```javascript
const axios = require('axios');

const BASE_URL = 
  'https://api.nexalayer.net/v1';

async function quickStart() {
  // Step 1: 注册（仅需一次）
  const regResp = await axios.post(
    `${BASE_URL}/account/register`, 
    {
      name: 'My AI Agent',
      contact_email: 'dev@example.com'
    }
  );
  const { api_key } = regResp.data.data;
  // 纯 API Key 认证，无需 Token！
  const headers = { 'X-API-Key': api_key };

  // Step 2: 创建 Session（异步）
  const sessResp = await axios.post(
    `${BASE_URL}/sessions`,
    {
      type: 'dynamic',
      config: {
        product_no: 'out_dynamic_1',
        traffic_gb: 1,
        protocol: 'socks5',
        country: 'US'
      }
    },
    { headers }
  );
  
  const sessionId = sessResp.data.data.session_id;
  
  // 等待 Session 就绪
  let proxy;
  while (true) {
    const statusResp = await axios.get(
      `${BASE_URL}/sessions/${sessionId}`,
      { headers }
    );
    if (statusResp.data.data.status === 'active') {
      proxy = statusResp.data.data.proxy;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('代理地址:', proxy.full_url);
}

quickStart();
```

---

## 2. 认证指南

### 2.1 两种认证模式

| 模式 | 适用场景 | 复杂度 |
|------|---------|:------:|
| **纯 API Key**（推荐） | AI Agent、服务端调用 | ⭐ |
| JWT Token | Web 控制台、高安全场景 | ⭐⭐⭐ |

### 2.2 模式一：纯 API Key（推荐 AI Agent）

**最简单的方式**，每个请求只需加一个 Header：

```bash
# 所有请求只需这一个 Header
curl -X GET \
  https://api.nexalayer.net/v1/account/info \
  -H "X-API-Key: ak_xxxxxxxxxxxxxxxx"
```

> 💡 **零维护成本**，无需 Token 管理、无需刷新。
> API Key 长期有效，直到手动轮换。

### 2.3 模式二：JWT Token（可选）

如果需要更高安全性，可以用 API Key + Secret 
换取短期 JWT Token：

```bash
# 获取 Token
curl -X POST \
  https://api.nexalayer.net/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "ak_xxxxxxxxxxxxxxxx",
    "api_secret": "sk_xxxxxxxxxxxxxxxx"
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "agent": {
      "id": 1,
      "name": "My AI Agent",
      "permissions": [
        "proxy:read",
        "proxy:write",
        "session:manage",
        "billing:read"
      ]
    }
  }
}
```

使用 Token：
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token 刷新：
```bash
curl -X POST \
  https://api.nexalayer.net/v1/auth/refresh \
  -H "Authorization: Bearer <current_token>"
```

### 2.4 认证建议

| 建议 | 说明 |
|------|------|
| **AI Agent 用 API Key** | 一个环境变量搞定，零运维 |
| 安全存储 | API Key 存放在环境变量中，不要硬编码 |
| JWT 仅在需要时用 | 控制台或需要细粒度权限控制时 |
| Token 提前刷新 | 使用 JWT 时，到期前 5 分钟刷新 |

---

## 3. 账户管理

### 3.1 注册账户

```bash
curl -X POST \
  https://api.nexalayer.net/v1/account/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My AI Agent",
    "contact_email": "agent@example.com",
    "webhook_url": "https://my-server.com/webhook"
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "agent_id": 1,
    "name": "My AI Agent",
    "api_key": "ak_a1b2c3d4e5f6g7h8",
    "api_secret": "sk_x9y8z7w6v5u4t3s2r1q0...",
    "status": "active",
    "trial": {
      "is_trial": true,
      "trial_balance": 5.00,
      "trial_expires_at": "2026-03-17T10:00:00Z"
    },
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

> 💡 **试用资源**: 如需试用，请联系 Telegram 售后
> support@nexalayer.net（备用 Telegram @LEWISMIN）。售后配置完成后，
> 使用 `provisioning_mode=existing` 创建 Session，避免重复下单或扣费。
>
> ⚠️ **重要**: 使用纯 API Key 模式时，只需保存
> `api_key` 即可。`api_secret` 仅在 JWT 模式
> 下需要，且仅返回一次。

### 3.2 查看账户信息

```bash
curl -X GET \
  https://api.nexalayer.net/v1/account/info \
  -H "X-API-Key: <api_key>"
```

### 3.3 更新账户信息

```bash
curl -X PUT \
  https://api.nexalayer.net/v1/account/info \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Agent Name",
    "webhook_url": "https://new-server.com/webhook"
  }'
```

### 3.4 重新生成 Secret

```bash
curl -X POST \
  https://api.nexalayer.net/v1/account/rotate-secret \
  -H "X-API-Key: <api_key>"
```

> 调用后，旧的 api_secret 立即失效。
> 如使用纯 API Key 模式，此操作不影响 api_key。

---

## 4. 余额与充值

### 4.1 查询余额

```bash
curl -X GET \
  https://api.nexalayer.net/v1/billing/balance \
  -H "X-API-Key: <api_key>"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "balance": 1000.00,
    "currency": "CNY",
    "frozen": 0.00,
    "available": 1000.00,
    "last_recharge_at": "2026-02-14T08:00:00Z"
  }
}
```

### 4.2 USDT 充值

#### Step 1: 创建充值订单

```bash
curl -X POST \
  https://api.nexalayer.net/v1/billing/recharge \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500.00,
    "payment_method": "usdt"
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "order_id": "PAY20260215100000xxxx",
    "amount": 500.00,
    "amount_usdt": 69.44,
    "usdt_rate": 7.2,
    "wallet_address": "TXxxxxxxxxxxxxxxxxxxxx",
    "network": "TRC20",
    "expire_time": "2026-02-15T11:00:00Z",
    "status": "pending"
  }
}
```

#### Step 2: 转账 USDT

向返回的 `wallet_address` 转账 `amount_usdt` 数量的 USDT（TRC20 网络）。

#### Step 3: 查询充值状态

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/billing/recharge/PAY20260215100000xxxx/status" \
  -H "X-API-Key: <api_key>"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "order_id": "PAY20260215100000xxxx",
    "status": "paid",
    "amount": 500.00,
    "paid_amount_usdt": 69.44,
    "confirmations": 6,
    "completed_at": "2026-02-15T10:15:00Z"
  }
}
```

**充值状态说明**:

| 状态 | 说明 |
|------|------|
| `pending` | 等待支付 |
| `confirming` | 已检测到链上交易，等待确认 |
| `paid` | 支付成功，余额已到账 |
| `expired` | 订单已过期 |
| `failed` | 支付失败 |

### 4.3 查看交易记录

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/billing/transactions?page=1&page_size=20&type=all" \
  -H "X-API-Key: <api_key>"
```

---

## 5. 代理产品

### 5.1 产品类型

系统提供两大类代理产品：

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| **动态代理** | IP 可轮换，按流量计费 | 爬虫、数据采集、多 IP 需求 |
| **静态代理** | 固定 IP，按时长计费 | 账号注册、长期登录、SEO 监测 |

### 5.2 查看产品列表

```bash
# 查看所有产品
curl -X GET \
  "https://api.nexalayer.net/v1/products" \
  -H "X-API-Key: <api_key>"

# 按类型筛选
curl -X GET \
  "https://api.nexalayer.net/v1/products?type=dynamic" \
  -H "X-API-Key: <api_key>"

# 按地区筛选
curl -X GET \
  "https://api.nexalayer.net/v1/products?country=US" \
  -H "X-API-Key: <api_key>"
```

### 5.3 查看可用地域

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/products/regions" \
  -H "X-API-Key: <api_key>"
```

### 5.4 产品推荐

不确定选什么？让系统帮你推荐：

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/products/recommend" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "use_case": "web_scraping",
    "target_region": "US",
    "budget": 100.00,
    "session_count": 5,
    "require_sticky_ip": false
  }'
```

**use_case 可选值**:

| 值 | 说明 |
|------|------|
| `web_scraping` | 网页爬取 |
| `data_collection` | 数据采集 |
| `account_management` | 账号管理 |
| `ad_verification` | 广告验证 |
| `seo_monitoring` | SEO 监测 |
| `market_research` | 市场调研 |
| `general` | 通用用途 |

---

## 6. Session 管理（核心）

Session 是使用代理的核心概念。每个 Session 代表一个代理使用会话，包含完整的连接信息。

### 6.1 Session 生命周期

```
creating → active → [rotating] → expired
                  ↘ error
                  ↘ terminated (手动终止)
```

### 6.2 创建动态代理 Session

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/sessions" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: create_dynamic_001" \
  -d '{
    "type": "dynamic",
    "config": {
      "product_no": "out_dynamic_1",
      "traffic_gb": 10,
      "protocol": "socks5",
      "country": "US",
      "city": "LA",
      "rotation": {
        "mode": "timed",
        "interval_seconds": 300
      }
    }
  }'
```

**响应**（异步创建，初始返回 `creating` 状态）:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_a1b2c3d4-e5f6-7890",
    "type": "dynamic",
    "status": "creating",
    "message": "Session 正在创建中，请轮询查询状态",
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

**轮询直到就绪**（status 变为 `active`）：
```bash
curl -X GET \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890" \
  -H "X-API-Key: <api_key>"
```

```json
{
  "success": true,
  "data": {
    "session_id": "sess_a1b2c3d4-e5f6-7890",
    "type": "dynamic",
    "status": "active",
    "proxy": {
      "host": "proxy.example.com",
      "port": 10001,
      "username": "user_abc123",
      "password": "pass_xyz789",
      "protocol": "socks5",
      "full_url": "socks5://user_abc123:pass_xyz789@proxy.example.com:10001"
    },
    "location": {
      "country": "US",
      "city": "LA"
    },
    "rotation": {
      "mode": "timed",
      "interval_seconds": 300,
      "next_rotation_at": "2026-02-15T10:05:00Z"
    },
    "health": {
      "risk_level": "low",
      "health_score": 100,
      "success_rate": 1.0
    },
    "usage": {
      "traffic_total_gb": 10,
      "traffic_used_gb": 0,
      "traffic_remaining_gb": 10
    },
    "expires_at": "2026-03-15T10:00:00Z",
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

> 💡 **Session 异步创建**：后端代理开通可能耗时
> 数秒到数十秒。创建 API 立即返回 `creating` 
> 状态，后台异步完成。Agent 可通过轮询或
> Webhook 获取就绪通知。
>
> 动态 Session 的后端链路使用
> `POST /api/business/dynamic-proxy/open` 开通/充值
> 动态账号；如果开通响应没有直接返回代理 URL，
> Agent Layer 再调用 `POST /api/business/dynamic-proxy/extract`
> 兜底提取。不要把 `POST /api/open/app/order/create/v2`
> 当成动态 Session 开通接口，它只会创建订单记录，
> 不保证 DYN3 账号可提取。

**动态代理配置参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `product_no` | string | ✅ | 产品编号 |
| `traffic_gb` | number | ✅ | 流量(GB) |
| `protocol` | string | ❌ | socks5 / http，默认 socks5 |
| `country` | string | ❌ | 国家代码 |
| `city` | string | ❌ | 城市代码 |
| `rotation.mode` | string | ❌ | fixed / timed / on_demand |
| `rotation.interval_seconds` | number | ❌ | 自动轮换间隔(秒) |

**轮换模式说明**:

| 模式 | 说明 |
|------|------|
| `fixed` | 固定 IP，不自动轮换 |
| `timed` | 定时轮换，按 interval_seconds 自动切换 |
| `on_demand` | 按需轮换，仅手动调用 rotate 时切换 |

### 6.3 创建静态代理 Session

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/sessions" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: create_static_001" \
  -d '{
    "type": "static",
    "config": {
      "product_no": "LM_US_LA_01",
      "quantity": 2,
      "duration_days": 30,
      "country": "US",
      "city": "LA"
    }
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_x1y2z3w4-a5b6-7890",
    "type": "static",
    "status": "active",
    "proxy": {
      "host": "192.168.1.100",
      "port": 40000,
      "username": "static_user01",
      "password": "static_pass01",
      "protocol": "socks5",
      "full_url": "socks5://static_user01:static_pass01@192.168.1.100:40000"
    },
    "location": {
      "country": "US",
      "city": "LA"
    },
    "ip_list": [
      "192.168.1.100",
      "192.168.1.101"
    ],
    "expires_at": "2026-03-17T10:00:00Z",
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

**静态代理配置参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `product_no` | string | ✅ | 产品编号 |
| `quantity` | number | ✅ | IP 数量 |
| `duration_days` | number | ✅ | 时长(天)，30/90 |
| `country` | string | ✅ | 国家代码 |
| `city` | string | ❌ | 城市代码 |

### 6.4 查看 Session 列表

```bash
# 查看所有活跃 Session
curl -X GET \
  "https://api.nexalayer.net/v1/sessions?status=active" \
  -H "X-API-Key: <api_key>"

# 按类型筛选
curl -X GET \
  "https://api.nexalayer.net/v1/sessions?type=dynamic&page=1&page_size=20" \
  -H "X-API-Key: <api_key>"
```

### 6.5 查看 Session 详情

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890" \
  -H "X-API-Key: <api_key>"
```

### 6.6 轮换代理 IP

仅适用于动态代理 Session。**建议传入轮换原因**，
有助于系统收集风控数据：

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890/rotate" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "http_403"
  }'
```

**reason 可选值**:

| 值 | 说明 |
|------|------|
| `http_403` | 目标返回 403 |
| `http_429` | 目标返回 429 限流 |
| `captcha` | 触发验证码 |
| `timeout` | 连接超时 |
| `block` | IP 被封禁 |
| `scheduled` | 定时轮换 |
| `manual` | 手动轮换（默认） |

**响应**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_a1b2c3d4-e5f6-7890",
    "old_proxy": {
      "host": "proxy.example.com",
      "port": 10001
    },
    "new_proxy": {
      "host": "proxy.example.com",
      "port": 10002,
      "username": "user_new123",
      "password": "pass_new789",
      "protocol": "socks5",
      "full_url": "socks5://user_new123:pass_new789@proxy.example.com:10002"
    },
    "rotated_at": "2026-02-15T10:05:00Z"
  }
}
```

### 6.7 续费 Session

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_x1y2z3w4-a5b6-7890/renew" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: renew_001" \
  -d '{
    "duration_days": 30
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_x1y2z3w4-a5b6-7890",
    "old_expires_at": "2026-03-17T10:00:00Z",
    "new_expires_at": "2026-04-16T10:00:00Z",
    "cost": 50.00,
    "renewed_at": "2026-02-15T10:00:00Z"
  }
}
```

### 6.8 终止 Session

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890/terminate" \
  -H "X-API-Key: <api_key>"
```

### 6.9 查看 Session 使用量

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890/usage" \
  -H "X-API-Key: <api_key>"
```

### 6.10 管理 IP 白名单

```bash
# 添加 IP
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890/whitelist" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "ips": ["203.0.113.1", "198.51.100.5"]
  }'

# 删除 IP
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_a1b2c3d4-e5f6-7890/whitelist" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "ips": ["203.0.113.1"]
  }'
```

---

## 7. 遥测上报（Telemetry）

Telemetry 是 Agent Layer 的核心能力。通过上报代理
使用效果，系统可以跟踪 Session 健康状态，未来驱动
智能调度。**强烈建议所有 Agent 都上报使用事件**。

### 7.1 上报使用事件

```bash
# 上报成功事件
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_xxx/report-event" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "success",
    "status_code": 200,
    "latency_ms": 320,
    "target_host": "example.com"
  }'

# 上报错误事件（如 403）
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_xxx/report-event" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "http_error",
    "status_code": 403,
    "latency_ms": 150,
    "target_host": "example.com",
    "error_message": "Forbidden"
  }'

# 上报验证码事件
curl -X POST \
  "https://api.nexalayer.net/v1/sessions/sess_xxx/report-event" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "captcha",
    "target_host": "example.com",
    "error_message": "CAPTCHA detected"
  }'
```

**event_type 可选值**:

| 值 | 说明 |
|------|------|
| `success` | 请求成功 |
| `http_error` | HTTP 错误（配合 status_code） |
| `captcha` | 触发验证码 |
| `timeout` | 连接/请求超时 |
| `block` | IP 被封禁 |
| `rate_limit` | 触发目标网站限流 |
| `custom` | 自定义事件 |

**响应**（含实时健康建议）:
```json
{
  "success": true,
  "data": {
    "event_id": "evt_xxxxxxxx",
    "session_health": {
      "risk_level": "medium",
      "health_score": 72,
      "success_rate": 0.85,
      "consecutive_failures": 3,
      "recommendation": "consider_rotate"
    }
  }
}
```

**recommendation 含义**:

| 值 | 说明 | 建议操作 |
|------|------|---------|
| `ok` | 状态良好 | 继续使用 |
| `consider_rotate` | 风险升高 | 考虑轮换 IP |
| `rotate_now` | 高风险 | 立即轮换 |
| `pause` | 极高风险 | 暂停使用，等待冷却 |

### 7.2 批量上报

减少网络开销，一次上报多个事件：

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/telemetry/batch" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "session_id": "sess_xxx",
        "event_type": "success",
        "status_code": 200,
        "latency_ms": 200
      },
      {
        "session_id": "sess_xxx",
        "event_type": "http_error",
        "status_code": 429,
        "latency_ms": 150
      }
    ]
  }'
```

### 7.3 查看 Session 健康指标

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/sessions/sess_xxx/health" \
  -H "X-API-Key: <api_key>"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "risk_level": "low",
    "health_score": 95,
    "success_rate": 0.97,
    "block_probability": 0.03,
    "consecutive_failures": 0,
    "recommendation": "ok",
    "stats_24h": {
      "total_requests": 150,
      "success_count": 146,
      "error_count": 4,
      "avg_latency_ms": 320
    }
  }
}
```

### 7.4 Python Telemetry 集成示例

```python
def request_with_telemetry(
    session_id, url, proxies, headers
):
    """发送请求并自动上报 telemetry"""
    start = time.time()
    try:
        resp = requests.get(
            url, proxies=proxies, timeout=30
        )
        latency = int((time.time() - start) * 1000)
        
        # 上报事件
        event_type = (
            "success" if resp.status_code < 400
            else "http_error"
        )
        report = requests.post(
            f"{BASE}/sessions/{session_id}"
            "/report-event",
            json={
                "event_type": event_type,
                "status_code": resp.status_code,
                "latency_ms": latency,
                "target_host": url.split("/")[2]
            },
            headers=headers
        ).json()["data"]
        
        # 根据建议自动轮换
        rec = report["session_health"]["recommendation"]
        if rec == "rotate_now":
            rotate_proxy(session_id, 
                reason=f"http_{resp.status_code}")
        
        return resp
        
    except requests.Timeout:
        latency = int((time.time() - start) * 1000)
        requests.post(
            f"{BASE}/sessions/{session_id}"
            "/report-event",
            json={
                "event_type": "timeout",
                "latency_ms": latency,
                "target_host": url.split("/")[2]
            },
            headers=headers
        )
        raise
```

---

## 8. 统计与查询

### 8.1 概览统计

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/stats/overview" \
  -H "X-API-Key: <api_key>"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "balance": 1000.00,
    "active_sessions": 5,
    "total_sessions": 20,
    "today_traffic_gb": 2.5,
    "month_traffic_gb": 45.0,
    "today_cost": 25.00,
    "month_cost": 450.00
  }
}
```

### 8.2 流量统计

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/stats/traffic?granularity=day&start_date=2026-02-01&end_date=2026-02-15" \
  -H "X-API-Key: <api_key>"
```

### 8.3 费用统计

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/stats/cost?period=month" \
  -H "X-API-Key: <api_key>"
```

### 8.4 使用报告

```bash
curl -X GET \
  "https://api.nexalayer.net/v1/billing/usage-report?period=week" \
  -H "X-API-Key: <api_key>"
```

---

## 9. Webhook 事件

### 9.1 配置 Webhook

在注册时或更新账户时设置 `webhook_url`：

```bash
curl -X PUT \
  "https://api.nexalayer.net/v1/account/info" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-server.com/webhook"
  }'
```

### 9.2 事件格式

当事件发生时，系统会向 `webhook_url` 发送 POST 请求：

```json
{
  "event_type": "session.expired",
  "event_id": "evt_xxxxxxxxxxxx",
  "agent_id": 1,
  "timestamp": "2026-02-15T10:00:00Z",
  "data": {
    "session_id": "sess_a1b2c3d4-e5f6-7890",
    "type": "dynamic",
    "reason": "traffic_exhausted"
  }
}
```

### 9.3 事件类型

| 事件 | 触发条件 |
|------|---------|
| `session.created` | Session 创建成功 |
| `session.expired` | Session 到期或流量耗尽 |
| `session.error` | Session 出现异常 |
| `session.rotated` | 代理 IP 已轮换 |
| `balance.low` | 余额低于阈值（默认 100 CNY） |
| `recharge.completed` | 充值到账 |
| `traffic.threshold` | 流量使用超过 80% |

### 9.4 测试 Webhook

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/webhook/test" \
  -H "X-API-Key: <api_key>"
```

---

## 10. 错误处理

### 10.1 错误响应格式

所有错误都遵循统一格式：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "余额不足，当前余额 50.00，需要 100.00",
    "details": {
      "current_balance": 50.00,
      "required_amount": 100.00
    }
  },
  "meta": {
    "request_id": "req_xxxx"
  }
}
```

### 10.2 错误码一览

| 错误码 | HTTP | 说明 | 建议处理方式 |
|--------|:----:|------|-------------|
| `AUTH_INVALID_KEY` | 401 | API Key 无效 | 检查 Key 是否正确 |
| `AUTH_EXPIRED_TOKEN` | 401 | Token 过期 | 重新获取 Token |
| `AUTH_INSUFFICIENT_PERMISSION` | 403 | 权限不足 | 检查账户权限 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求过于频繁 | 降低请求频率，等待后重试 |
| `ACCOUNT_DISABLED` | 403 | 账户已禁用 | 联系管理员 |
| `INSUFFICIENT_BALANCE` | 402 | 余额不足 | 充值后重试 |
| `SESSION_NOT_FOUND` | 404 | Session 不存在 | 检查 session_id |
| `SESSION_EXPIRED` | 410 | Session 已过期 | 创建新 Session |
| `SESSION_LIMIT_REACHED` | 429 | Session 上限 | 终止旧 Session |
| `PRODUCT_NOT_FOUND` | 404 | 产品不存在 | 查询产品列表 |
| `PRODUCT_OUT_OF_STOCK` | 409 | 库存不足 | 更换产品或等待 |
| `INVALID_REQUEST` | 400 | 参数错误 | 检查请求参数 |
| `IDEMPOTENCY_CONFLICT` | 409 | 幂等键冲突 | 使用新的幂等键 |
| `BACKEND_ERROR` | 502 | 后端服务异常 | 稍后重试 |
| `BACKEND_TIMEOUT` | 504 | 后端超时 | 稍后重试 |
| `INTERNAL_ERROR` | 500 | 内部错误 | 联系技术支持 |

### 10.3 Rate Limit 响应头

当触发频率限制时，响应会包含以下 Header：

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708000060
Retry-After: 30
```

| Header | 说明 |
|--------|------|
| `X-RateLimit-Limit` | 每分钟请求上限 |
| `X-RateLimit-Remaining` | 剩余可用次数 |
| `X-RateLimit-Reset` | 限制重置时间戳 |
| `Retry-After` | 建议等待秒数（仅 429） |

> 所有响应都包含前三个 Header，便于 Agent
> 主动控制请求频率，避免触发限流。

### 10.4 重试策略建议

```python
import time
import requests

def api_request_with_retry(
    method, url, max_retries=3, **kwargs
):
    """带重试的 API 请求"""
    for attempt in range(max_retries):
        try:
            resp = requests.request(
                method, url, **kwargs
            )
            
            # 成功
            if resp.status_code < 400:
                return resp.json()
            
            error = resp.json().get("error", {})
            code = error.get("code", "")
            
            # 不可重试的错误
            if code in [
                "AUTH_INVALID_KEY",
                "INSUFFICIENT_BALANCE",
                "INVALID_REQUEST",
                "SESSION_NOT_FOUND"
            ]:
                return resp.json()
            
            # Token 过期，刷新后重试
            if code == "AUTH_EXPIRED_TOKEN":
                refresh_token()
                continue
            
            # 频率限制，等待后重试
            if code == "RATE_LIMIT_EXCEEDED":
                retry_after = int(
                    resp.headers.get("Retry-After", 60)
                )
                time.sleep(retry_after)
                continue
            
            # 后端错误，指数退避重试
            if code in [
                "BACKEND_ERROR", "BACKEND_TIMEOUT"
            ]:
                wait = 2 ** attempt
                time.sleep(wait)
                continue
                
        except requests.RequestException:
            wait = 2 ** attempt
            time.sleep(wait)
            continue
    
    raise Exception("Max retries exceeded")
```

---

## 11. 最佳实践

### 11.1 Session 管理最佳实践

#### ✅ 推荐做法

```python
# 1. 使用幂等键防止重复创建
resp = requests.post(
    f"{BASE_URL}/sessions",
    json={...},
    headers={
        **auth_headers,
        "Idempotency-Key": f"create_{task_id}"
    }
)

# 2. 在不需要时及时终止 Session
requests.post(
    f"{BASE_URL}/sessions/{session_id}/terminate",
    headers=auth_headers
)

# 3. 监控流量使用，避免意外耗尽
usage = requests.get(
    f"{BASE_URL}/sessions/{session_id}/usage",
    headers=auth_headers
).json()["data"]
if usage["traffic"]["usage_percentage"] > 80:
    # 考虑购买更多流量或切换 Session
    pass

# 4. 批量操作时控制并发
import asyncio
semaphore = asyncio.Semaphore(5)  # 最多 5 个并发
```

#### ❌ 避免做法

```python
# 1. 不要创建了不关闭
# BAD: 创建后忘记清理
session = create_session()
# ... 用完就不管了

# 2. 不要无脑定时轮换
# BAD: 每 N 个请求就轮换
for i, url in enumerate(urls):
    if i % 3 == 0:
        rotate_proxy(session_id)  # 浪费！
    fetch(url)
# GOOD: 根据错误智能轮换
for url in urls:
    resp = fetch(url)
    if resp.status_code in (403, 429):
        rotate_proxy(
            session_id, 
            reason=f"http_{resp.status_code}"
        )

# 3. 不要硬编码凭证
# BAD:
api_key = "ak_xxxxxxxx"  # 不要这样！
# GOOD:
api_key = os.environ["AGENT_API_KEY"]

# 4. 不要忘记上报 Telemetry
# BAD: 只用代理，不上报效果
# GOOD: 每次请求后上报 success/error
```

### 11.2 性能优化建议

| 建议 | 说明 |
|------|------|
| **复用 Session** | 一个 Session 处理多个请求，无需每次新建 |
| **智能轮换** | 根据 Telemetry 建议轮换，而非固定间隔 |
| **上报 Telemetry** | 帮助系统优化代理质量，提升成功率 |
| **缓存产品信息** | 产品列表变化不频繁，建议缓存 5-10 分钟 |
| **使用连接池** | HTTP 客户端使用连接池复用连接 |
| **异步请求** | 批量操作使用异步并发，控制并发数 |
| **关注 Rate Limit** | 读取响应头中的限流信息，主动控速 |

### 11.3 安全建议

| 建议 | 说明 |
|------|------|
| 环境变量存储 | API Key/Secret 存放在环境变量中 |
| HTTPS 通信 | 所有 API 调用使用 HTTPS |
| Token 定期刷新 | 不要使用过期 Token |
| 限制 IP 白名单 | 如果部署在固定 IP，配置 IP 白名单 |
| 监控异常调用 | 关注 API 调用日志，发现异常及时处理 |

---

## 12. SDK 使用示例

### 12.1 Python 完整示例

```python
"""
AI Agent 代理使用完整示例
场景：批量爬取美国网站，使用动态代理 + Telemetry
"""
import os
import time
import requests

class ProxyAgentClient:
    """代理 Agent 客户端（纯 API Key 认证）"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.api_key = os.environ["AGENT_API_KEY"]
    
    @property
    def headers(self):
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def get_balance(self) -> float:
        """查询余额"""
        resp = requests.get(
            f"{self.base_url}/billing/balance",
            headers=self.headers
        )
        return resp.json()["data"]["balance"]
    
    def create_dynamic_session(
        self,
        traffic_gb: int = 1,
        country: str = "US",
        protocol: str = "http"
    ) -> dict:
        """创建动态代理 Session（异步）"""
        key = f"sess_{country}_{int(time.time())}"
        resp = requests.post(
            f"{self.base_url}/sessions",
            json={
                "type": "dynamic",
                "config": {
                    "product_no": "out_dynamic_1",
                    "traffic_gb": traffic_gb,
                    "protocol": protocol,
                    "country": country,
                    "rotation": {"mode": "on_demand"}
                }
            },
            headers={
                **self.headers,
                "Idempotency-Key": key
            }
        )
        data = resp.json()["data"]
        session_id = data["session_id"]
        
        # 等待 Session 就绪
        while data["status"] == "creating":
            time.sleep(2)
            data = requests.get(
                f"{self.base_url}/sessions/"
                f"{session_id}",
                headers=self.headers
            ).json()["data"]
        
        return data
    
    def report_event(
        self, session_id: str,
        event_type: str, **kwargs
    ) -> dict:
        """上报 Telemetry 事件"""
        payload = {"event_type": event_type}
        payload.update(kwargs)
        resp = requests.post(
            f"{self.base_url}/sessions/"
            f"{session_id}/report-event",
            json=payload,
            headers=self.headers
        )
        return resp.json()["data"]
    
    def rotate_proxy(
        self, session_id: str, reason: str = "manual"
    ) -> dict:
        """轮换代理 IP（附带原因）"""
        resp = requests.post(
            f"{self.base_url}/sessions/"
            f"{session_id}/rotate",
            json={"reason": reason},
            headers=self.headers
        )
        return resp.json()["data"]
    
    def terminate_session(self, session_id: str):
        """终止 Session"""
        requests.post(
            f"{self.base_url}/sessions/"
            f"{session_id}/terminate",
            headers=self.headers
        )


def main():
    """主流程：智能轮换 + Telemetry 上报"""
    client = ProxyAgentClient(
        "https://api.nexalayer.net/v1"
    )
    
    # 检查余额
    balance = client.get_balance()
    print(f"当前余额: ¥{balance:.2f}")
    if balance < 10:
        print("余额不足，请充值")
        return
    
    # 创建 Session（自动等待就绪）
    session = client.create_dynamic_session(
        traffic_gb=5, country="US"
    )
    session_id = session["session_id"]
    proxy_url = session["proxy"]["full_url"]
    print(f"Session 就绪: {session_id}")
    
    proxies = {
        "http": proxy_url, 
        "https": proxy_url
    }
    
    urls = [
        "https://httpbin.org/ip",
        "https://httpbin.org/headers",
        "https://httpbin.org/get"
    ]
    
    try:
        for i, url in enumerate(urls):
            start = time.time()
            try:
                resp = requests.get(
                    url, proxies=proxies, timeout=30
                )
                latency = int(
                    (time.time() - start) * 1000
                )
                
                # 上报 Telemetry 事件
                event_type = (
                    "success" if resp.status_code < 400
                    else "http_error"
                )
                report = client.report_event(
                    session_id,
                    event_type=event_type,
                    status_code=resp.status_code,
                    latency_ms=latency,
                    target_host=url.split("/")[2]
                )
                
                # 根据健康建议智能轮换
                rec = report["session_health"]
                recommendation = rec["recommendation"]
                if recommendation in (
                    "rotate_now", "consider_rotate"
                ):
                    reason = f"http_{resp.status_code}"
                    new = client.rotate_proxy(
                        session_id, reason=reason
                    )
                    proxy_url = (
                        new["new_proxy"]["full_url"]
                    )
                    proxies = {
                        "http": proxy_url,
                        "https": proxy_url
                    }
                    print(f"  ↻ IP 已轮换 ({reason})")
                
                print(
                    f"[{i+1}] {url} → "
                    f"{resp.status_code}"
                )
                
            except requests.Timeout:
                # 超时也上报
                client.report_event(
                    session_id,
                    event_type="timeout",
                    target_host=url.split("/")[2]
                )
                print(f"[{i+1}] {url} → TIMEOUT")
            
            time.sleep(1)
    
    finally:
        client.terminate_session(session_id)
        print(f"Session 已终止: {session_id}")


if __name__ == "__main__":
    main()
```

### 12.2 Node.js 完整示例

```javascript
/**
 * AI Agent 代理使用完整示例
 * 场景：使用静态代理进行长期账号管理
 * 认证方式：纯 API Key（推荐）
 */
const axios = require('axios');

const BASE_URL = 
  'https://api.nexalayer.net/v1';

class ProxyAgentClient {
  constructor() {
    this.apiKey = process.env.AGENT_API_KEY;
  }

  get headers() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async createStaticSession(config) {
    const resp = await axios.post(
      `${BASE_URL}/sessions`,
      {
        type: 'static',
        config: {
          product_no: config.productNo,
          quantity: config.quantity || 1,
          duration_days: config.durationDays || 30,
          country: config.country,
          city: config.city
        }
      },
      {
        headers: {
          ...this.headers,
          'Idempotency-Key': 
            `static_${Date.now()}`
        }
      }
    );
    
    // 异步等待 Session 就绪
    let data = resp.data.data;
    while (data.status === 'creating') {
      await new Promise(r => setTimeout(r, 2000));
      const statusResp = await axios.get(
        `${BASE_URL}/sessions/${data.session_id}`,
        { headers: this.headers }
      );
      data = statusResp.data.data;
    }
    return data;
  }

  async reportEvent(sessionId, event) {
    const resp = await axios.post(
      `${BASE_URL}/sessions/${sessionId}`
      + '/report-event',
      event,
      { headers: this.headers }
    );
    return resp.data.data;
  }

  async renewSession(sessionId, durationDays) {
    const resp = await axios.post(
      `${BASE_URL}/sessions/${sessionId}/renew`,
      { duration_days: durationDays },
      {
        headers: {
          ...this.headers,
          'Idempotency-Key': 
            `renew_${sessionId}_${Date.now()}`
        }
      }
    );
    return resp.data.data;
  }

  async listSessions(status = 'active') {
    const resp = await axios.get(
      `${BASE_URL}/sessions?status=${status}`,
      { headers: this.headers }
    );
    return resp.data.data;
  }

  async terminateSession(sessionId) {
    await axios.post(
      `${BASE_URL}/sessions/${sessionId}/terminate`,
      {},
      { headers: this.headers }
    );
  }
}

async function main() {
  const client = new ProxyAgentClient();

  // 创建美国静态代理 Session（自动等待就绪）
  console.log('创建静态代理 Session...');
  const session = await client.createStaticSession({
    productNo: 'LM_US_LA_01',
    quantity: 1,
    durationDays: 30,
    country: 'US',
    city: 'LA'
  });

  console.log(`Session ID: ${session.session_id}`);
  console.log(`代理地址: ${session.proxy.full_url}`);
  console.log(`到期时间: ${session.expires_at}`);

  // 查看所有 Session
  const sessions = await client.listSessions();
  console.log(
    `活跃 Session: ${sessions.items.length}`
  );

  // 到期前续费
  const renewed = await client.renewSession(
    session.session_id, 30
  );
  console.log(
    `续费成功: ${renewed.new_expires_at}`
  );
}

main().catch(console.error);
```

### 12.3 cURL 常用命令速查

```bash
# 设置变量
BASE=https://api.nexalayer.net
K="X-API-Key: ak_xxxxxxxx"

# === 账户 ===
curl $BASE/v1/account/info -H "$K"
curl $BASE/v1/billing/balance -H "$K"

# === Session ===
# 创建动态 Session
curl -X POST $BASE/v1/sessions \
  -H "$K" -H "Content-Type: application/json" \
  -d '{"type":"dynamic","config":{
    "product_no":"out_dynamic_1",
    "traffic_gb":1,"protocol":"http"}}'

# 查询 Session 状态
curl "$BASE/v1/sessions/$SID" -H "$K"

# 列出 Session
curl "$BASE/v1/sessions?status=active" -H "$K"

# 轮换 IP（带原因）
curl -X POST $BASE/v1/sessions/$SID/rotate \
  -H "$K" -H "Content-Type: application/json" \
  -d '{"reason":"http_403"}'

# 上报 Telemetry
curl -X POST \
  $BASE/v1/sessions/$SID/report-event \
  -H "$K" -H "Content-Type: application/json" \
  -d '{"event_type":"success",
    "status_code":200,"latency_ms":200}'

# 查看 Session 健康
curl $BASE/v1/sessions/$SID/health -H "$K"

# 终止 Session
curl -X POST $BASE/v1/sessions/$SID/terminate \
  -H "$K"

# === 产品 ===
curl $BASE/v1/products -H "$K"
curl $BASE/v1/products/regions -H "$K"

# === 统计 ===
curl $BASE/v1/stats/overview -H "$K"
```

---

## 13. 指纹浏览器配置管理（Phase 2）

Profile 是指纹浏览器的核心概念。每个 Profile 代表一个
完整的浏览器数字身份，包含独立的指纹参数、代理绑定和
Cookie 数据。

### 13.1 创建浏览器配置

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/profiles" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "US Chrome Account",
    "tags": ["production", "ecommerce"],
    "fingerprint": {
      "os": "windows",
      "browser": "chrome",
      "browser_version": "120",
      "screen": { "width": 1920, "height": 1080 },
      "location": {
        "timezone": "America/New_York",
        "locale": "en-US"
      },
      "canvas": { "mode": "noise" },
      "webgl": { "mode": "noise" },
      "webrtc": { "mode": "fake" }
    },
    "proxy_binding": {
      "session_id": "sess_xxx",
      "auto_match": true
    }
  }'
```

> 未指定的指纹参数由系统自动生成，确保与 OS/Browser
> 组合一致。例如指定 `windows + chrome 120`，系统自动
> 生成匹配的 UA、GPU 渲染器、字体列表等。

### 13.2 批量创建配置

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/profiles/batch-create" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 10,
    "name_prefix": "US-Account",
    "template": {
      "os": "windows",
      "browser": "chrome",
      "location": {
        "timezone": "America/New_York",
        "locale": "en-US"
      }
    },
    "auto_bind_proxy": true,
    "proxy_country": "US"
  }'
```

### 13.3 生成随机指纹

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/fingerprints/generate" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "os": "windows",
    "browser": "chrome",
    "country": "US"
  }'
```

### 13.4 绑定代理到配置

```bash
# 手动绑定指定 Session
curl -X POST \
  "https://api.nexalayer.net/v1/profiles/prof_xxx/bind-proxy" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess_xxx"
  }'

# 自动匹配代理（按地理位置匹配）
curl -X POST \
  "https://api.nexalayer.net/v1/profiles/prof_xxx/bind-proxy" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "auto_match": true
  }'
```

> 自动匹配会根据 Profile 的时区和语言设置，找到地理
> 位置最匹配的活跃 Session 并绑定。同时校验代理 IP 的
> 时区与指纹设置是否一致。

### 13.5 验证指纹一致性

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/fingerprints/validate" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": { ... },
    "proxy_country": "US"
  }'
```

### 13.6 管理配置列表

```bash
# 查看所有配置
curl "https://api.nexalayer.net/v1/profiles" \
  -H "X-API-Key: <api_key>"

# 按分组筛选
curl "https://api.nexalayer.net/v1/profiles?group=us-accounts" \
  -H "X-API-Key: <api_key>"

# 按标签筛选
curl "https://api.nexalayer.net/v1/profiles?tags=production" \
  -H "X-API-Key: <api_key>"

# 克隆配置（指纹自动重新生成）
curl -X POST \
  "https://api.nexalayer.net/v1/profiles/prof_xxx/duplicate" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{ "new_name": "US Chrome Account - Copy" }'
```

---

## 14. 浏览器实例与自动化（Phase 3）

### 14.1 启动浏览器

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/browser/launch" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "prof_xxx",
    "headless": true,
    "options": {
      "start_url": "https://example.com",
      "viewport": { "width": 1920, "height": 1080 }
    }
  }'
```

> 启动浏览器时，系统自动加载 Profile 的指纹配置和
> 代理设置，通过反检测引擎注入指纹参数，确保浏览器
> 环境与配置完全一致。

### 14.2 执行自动化动作

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/browser/instances/inst_xxx/execute" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "type": "navigate",
        "url": "https://example.com/login" },
      { "type": "fill",
        "selector": "#email",
        "value": "user@example.com" },
      { "type": "fill",
        "selector": "#password",
        "value": "pass123" },
      { "type": "click",
        "selector": "button[type=submit]" },
      { "type": "wait_for",
        "selector": ".dashboard",
        "timeout_ms": 5000 },
      { "type": "screenshot" }
    ]
  }'
```

**支持的动作类型**:

| 动作 | 说明 | 参数 |
|------|------|------|
| `navigate` | 导航到 URL | url, wait_until |
| `click` | 点击元素 | selector |
| `fill` | 填写输入框（清空后输入） | selector, value |
| `type` | 追加输入文本 | selector, value |
| `select` | 选择下拉框选项 | selector, value |
| `hover` | 鼠标悬停 | selector |
| `scroll` | 滚动页面 | direction, distance |
| `wait` | 等待指定时间 | ms |
| `wait_for` | 等待元素出现 | selector, timeout_ms |
| `press` | 按键 | key |
| `screenshot` | 截图 | (可选) type, quality |
| `evaluate` | 执行 JS | script |

### 14.3 截图

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/browser/instances/inst_xxx/screenshot" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full_page",
    "format": "png",
    "quality": 80
  }'
```

### 14.4 Cookie 管理

```bash
# 获取当前 Cookie
curl "https://api.nexalayer.net/v1/browser/instances/inst_xxx/cookies" \
  -H "X-API-Key: <api_key>"

# 设置 Cookie
curl -X POST \
  "https://api.nexalayer.net/v1/browser/instances/inst_xxx/cookies" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": [
      {
        "name": "session_id",
        "value": "abc123",
        "domain": ".example.com",
        "path": "/"
      }
    ]
  }'
```

### 14.5 关闭浏览器

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/browser/instances/inst_xxx/close" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "save_cookies": true,
    "save_storage": true
  }'
```

> 关闭时可选择保存 Cookie 和 LocalStorage
> 到 Profile，下次启动时自动恢复。

---

## 15. 浏览器任务队列（Phase 3）

任务队列让 AI Agent 提交浏览器自动化任务后无需等待，
系统异步执行并收集结果。

### 15.1 提交任务

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/tasks" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "prof_xxx",
    "task_type": "scrape",
    "target_url": "https://example.com/products",
    "steps": [
      { "action": "navigate",
        "url": "https://example.com/products" },
      { "action": "wait_for",
        "selector": ".product-list" },
      { "action": "evaluate",
        "script": "return [...document.querySelectorAll(\".product\")].map(p => ({ name: p.querySelector(\".name\").textContent, price: p.querySelector(\".price\").textContent }))" },
      { "action": "screenshot" }
    ],
    "timeout_ms": 60000,
    "priority": "normal"
  }'
```

### 15.2 查询任务状态

```bash
curl "https://api.nexalayer.net/v1/tasks/task_xxx" \
  -H "X-API-Key: <api_key>"
```

**任务状态说明**:

| 状态 | 说明 |
|------|------|
| `queued` | 排队中 |
| `running` | 执行中 |
| `completed` | 执行完成 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |

### 15.3 Python 任务提交示例

```python
import time

def submit_and_wait(client, profile_id, url):
    """提交任务并等待结果"""
    task = client.post(
        "/v1/tasks",
        json={
            "profile_id": profile_id,
            "task_type": "scrape",
            "target_url": url,
            "steps": [
                {"action": "navigate", "url": url},
                {"action": "wait_for",
                 "selector": "body"},
                {"action": "evaluate",
                 "script": "return document.title"},
                {"action": "screenshot"}
            ]
        }
    ).json()["data"]

    task_id = task["task_id"]
    while True:
        status = client.get(
            f"/v1/tasks/{task_id}"
        ).json()["data"]
        if status["status"] in (
            "completed", "failed"
        ):
            return status
        time.sleep(2)
```

---

## 16. 反检测引擎（Phase 3）

### 16.1 运行检测测试

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/anti-detect/test" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "prof_xxx",
    "test_sites": ["pixelscan", "browserleaks", "creepjs"]
  }'
```

**响应**:
```json
{
  "success": true,
  "data": {
    "overall_score": 95,
    "results": {
      "pixelscan": { "passed": true, "score": 98 },
      "browserleaks": { "passed": true, "score": 92 },
      "creepjs": { "passed": true, "score": 95 }
    },
    "warnings": [],
    "leaked_info": []
  }
}
```

### 16.2 检查泄漏

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/anti-detect/check-leaks" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "inst_xxx"
  }'
```

---

## 17. MCP 接口（Phase 3）

通过 MCP (Model Context Protocol) 接口，AI Agent 可以
直接将浏览器操作作为工具使用。

### 17.1 获取工具列表

```bash
curl "https://api.nexalayer.net/v1/mcp/tools" \
  -H "X-API-Key: <api_key>"
```

### 17.2 执行工具

```bash
curl -X POST \
  "https://api.nexalayer.net/v1/mcp/execute" \
  -H "X-API-Key: <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "launch_browser",
    "arguments": {
      "profile_id": "prof_xxx",
      "headless": true,
      "start_url": "https://example.com"
    }
  }'
```

**可用 MCP 工具**:

| 工具名 | 说明 |
|--------|------|
| `create_browser_profile` | 创建浏览器配置 |
| `launch_browser` | 启动浏览器实例 |
| `navigate_to` | 导航到 URL |
| `execute_browser_task` | 提交自动化任务 |
| `take_screenshot` | 截图 |
| `close_browser` | 关闭浏览器 |
| `get_page_content` | 获取页面内容 |

---

## 18. FAQ

### Q1: Session 和代理 IP 是什么关系？

**A**: Session 是一个抽象概念，代表一次代理使用会话。
- 动态代理 Session：可以包含一个或多个代理 IP，支持轮换
- 静态代理 Session：包含一个或多个固定 IP，不支持轮换

### Q2: 动态代理和静态代理该怎么选？

**A**: 
| 需求 | 推荐 |
|------|------|
| 大量爬取、数据采集 | 动态代理 |
| 需要大量不同 IP | 动态代理 |
| 需要固定 IP | 静态代理 |
| 账号注册/登录 | 静态代理 |
| SEO 监测 | 静态代理 |
| 不确定 | 使用产品推荐 API |

### Q3: API Key 丢失了怎么办？

**A**: 使用当前有效的 Token 调用 `POST /v1/account/rotate-secret` 重新生成。如果 Token 也没有了，请联系管理员。

### Q4: 充值后多久到账？

**A**: USDT 充值通常在 6 个区块确认后到账（约 3-10 分钟）。可以通过充值状态查询接口实时查看状态。

### Q5: 频率限制是多少？

**A**: 默认限制：
- 每分钟 60 次请求
- 每天 10,000 次请求
- 创建操作每分钟 10 次

如果需要更高限制，请联系管理员。

### Q6: Session 到期后数据会保留吗？

**A**: Session 到期后状态变为 `expired`，历史数据保留 90 天，之后自动清理。

### Q7: 可以同时使用多少个 Session？

**A**: 默认每个 Agent 最多 100 个活跃 Session。如需提升限制，请联系管理员。

### Q8: 请求超时了怎么办？

**A**: 建议使用指数退避重试策略。创建 Session 等操作建议超时设为 30 秒，查询操作设为 10 秒。

### Q9: 代理 IP 被目标网站封了怎么办？

**A**: 
1. 上报 Telemetry 事件（`event_type: "block"`）
2. 查看系统返回的 `recommendation`
3. 动态代理：调用 rotate 接口（带 `reason`）轮换
4. 静态代理：联系技术支持更换 IP
5. 建议：适当降低请求频率，关注 health_score

### Q10: 如何申请试用？

**A**: 联系 售后邮箱 support@nexalayer.net（备用 Telegram @LEWISMIN），
由售后为对应邮箱账号配置资源；也可以自行通过 USDT 充值后直接使用。

### Q11: 为什么要上报 Telemetry？

**A**: Telemetry 是系统的核心能力：
1. 帮助系统了解代理 IP 的真实可用性
2. 实时获得轮换建议（`recommendation`）
3. 未来驱动智能调度，自动选择最优代理
4. 不上报也可正常使用，但无法获得健康建议

### Q12: 如何通过 MCP 协议接入？

**A**: Phase 3 已提供 MCP Server 接口。通过 `GET /v1/mcp/tools` 获取工具列表，`POST /v1/mcp/execute` 执行工具调用。AI Agent 可将浏览器操作作为 MCP 工具直接使用。

### Q13: Profile 和 Session 是什么关系？

**A**: Session 代表一个代理连接，Profile 代表一个浏览器身份。一个 Profile 可以绑定一个 Session，这样启动浏览器时会自动使用对应的代理 IP，并确保指纹参数（时区、语言等）与代理地理位置一致。

### Q14: 指纹参数不一致会怎样？

**A**: 指纹参数不一致（如美国代理但中国时区）会降低隐匿性。系统在绑定代理时会自动校验一致性，不一致时返回警告。建议使用 `POST /v1/fingerprints/validate` 预先检查。

### Q15: 浏览器实例的资源消耗如何？

**A**: 每个 Chromium 实例约占 100-500MB 内存。系统会监控资源占用，支持空闲超时自动关闭。默认每个 Agent 最多 10 个并发实例。

### Q16: 任务失败了怎么办？

**A**: 通过 `POST /v1/tasks/:id/retry` 重试失败任务。也可以在提交任务时设置 `max_retries` 参数让系统自动重试。

---

## 联系方式

- **技术支持**: 请通过管理系统提交工单
- **API 状态页**: `https://api.nexalayer.net/v1/health`

---

*手册结束 — 祝您使用愉快！*
