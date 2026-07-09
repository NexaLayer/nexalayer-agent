# AI Agent 网络执行层 — 自动化测试设计文档

> **版本**: v2.0  
> **日期**: 2026-03-08  
> **范围**: 冒烟测试（Smoke Test）— 功能、集成、回归、性能、安全、可观测性、上线验收  
> **原则**: 避免真实扣费/资源占用，验证 Agent Layer + Backend 双系统数据一致性  
> **v2.0 变更**: 新增 Phase 2（指纹配置）和 Phase 3（浏览器自动化）测试用例  
> **v1.1 变更**: 采纳 8 项 Review 建议（详见 §1.5 变更摘要）

---

## 目录

1. [测试环境与约束](#1-测试环境与约束)
2. [测试架构](#2-测试架构)
3. [TS-1 功能冒烟测试](#3-ts-1-功能冒烟测试)
4. [TS-2 跨系统集成测试](#4-ts-2-跨系统集成测试)
5. [TS-3 回归测试](#5-ts-3-回归测试)
6. [TS-4 性能冒烟测试](#6-ts-4-性能冒烟测试)
7. [TS-5 安全测试](#7-ts-5-安全测试)
8. [TS-6 可观测性测试](#8-ts-6-可观测性测试)
9. [TS-7 上线验收测试](#9-ts-7-上线验收测试)
10. [测试数据管理](#10-测试数据管理)
11. [测试工具与框架](#11-测试工具与框架)
12. [执行策略](#12-执行策略)

---

## 1. 测试环境与约束

### 1.1 系统拓扑

```
┌──────────────────────────────────────────────────┐
│               Test Runner (vitest)                │
│  ┌─────────────────┐   ┌──────────────────────┐  │
│  │ Agent Layer API  │   │  Backend API (验证)   │  │
│  │ (HTTP Client)    │   │  (HTTP Client)       │  │
│  └───────┬─────────┘   └──────────┬───────────┘  │
│          │                         │              │
└──────────┼─────────────────────────┼──────────────┘
           ▼                         ▼
  ┌─────────────────┐     ┌──────────────────────┐
  │  AIAgent 服务     │     │  Backend 服务         │
  │  (Railway)       │     │  (Railway)            │
  │  Port: 3000      │     │  Port: 8000           │
  └───────┬─────────┘     └──────────┬───────────┘
          │                          │
          ▼                          ▼
  ┌─────────────────┐     ┌──────────────────────┐
  │ Postgres-agent   │     │  Postgres (Backend)   │
  │ Agent 7 张表     │     │  Backend 30+ 张表     │
  └─────────────────┘     └──────────────────────┘
```

### 1.2 环境信息

| 项目 | 值 |
|------|-----|
| Agent Layer URL | `https://aiagent-production-9411.up.railway.app` |
| Backend API URL | `https://backend-production-127a.up.railway.app` |
| Agent DB | `postgresql://...@postgres-asiw.railway.internal:5432/railway` |
| Backend DB | 同一 Railway 项目下的 Postgres 实例 |
| openAgent 用户名 | `openAgent` |
| openAgent 用户 ID | `1474` |
| openAgent 身份 | `is_agent: true` |
| openAgent 余额 | 实时查询（测试前/后对比） |

### 1.3 约束条件

| 约束 | 说明 |
|------|------|
| **冒烟级别** | 每类测试只覆盖核心路径，不做穷举 |
| **禁止真实扣费** | 不执行真实 USDT 支付；通过管理员 API 充值余额供测试使用 ，代理商openAgent充值不超过100，用户充值每个不超过50，所有用户总额加起来不超过100|
| **资源可控** | 动态代理使用最小规格，每次开通1GB（1000MB）；**静态代理仅开 1 条、1 个月（真实扣费）**，测试后清理 |
| **动态白名单** | 白名单功能未实现，标记为 `skip` |
| **幂等安全** | 保留核心幂等验收用例（即使中间件未完成，也验证行为） |
| **隔离性** | 每次测试运行创建独立 Agent，互不干扰 |
| **环境保护** | 测试启动时检查 `AGENT_BASE_URL`，含 "production" 需设 `ALLOW_PROD=true` |
| **鉴权策略** | 系统支持双通道（X-API-Key 直连 + Bearer JWT），测试覆盖两条路径 |
| **弱断言** | 算法输出（health_score, risk_level, block_probability）使用范围断言而非精确值 |

### 1.4 测试余额充值策略

由于不执行真实 USDT 支付，测试使用管理员 API 为代理商/用户充值：

1. **openAgent 充值**: 使用 openAgent 身份调用 `POST /api/open/app/user/{user_id}/balance`
2. **用户充值**: 创建 Backend 用户后，通过 openAgent 为该用户余额 +1000
3. **余额验证**: Agent Layer `GET /v1/billing/balance` 与 Backend 余额对比

### 1.5 v1.1 变更摘要

| # | 变更 | 说明 |
|---|------|------|
| 1 | 静态产品查询 | 代码已补充静态产品查询，移除 skip |
| 2 | 管理员充值 | 测试前通过管理员 API 充值，保证后续扣款正常 |
| 3 | 鉴权双通道 | 测试覆盖 X-API-Key 和 Bearer JWT 两条认证路径 |
| 4 | 字段对齐 | 请求体字段与实际代码 schema 统一（session_type, product_no 等） |
| 5 | 弱断言 | health_score/risk_level/block_probability 改为范围断言 |
| 6 | 环境保护 | 启动时检查 URL 是否为生产环境 |
| 7 | 清理增强 | cleanup 带重试 + cleanup-report.json 兜底 |
| 8 | 幂等保留 | 保留核心幂等测试用例，不 skip |
| 9 | 性能软断言 | p95 改为警告阈值，仅 max 做硬断言 |

### 1.6 后端代理商体系说明

Agent Layer 创建的所有用户都在 Backend 的代理商 `openAgent`（ID=1474）名下：
- Agent 注册 → 调用 Backend `/api/open/app/user/create/v2`
- 创建的 Backend 用户：`agent_id = 1474`，`agent_name = "openAgent"`
- 代理开通扣费：扣用户余额 + 扣 openAgent 代理商余额
- 价格体系：未设置 openAgent 专属价格，按系统全局价格

---

## 2. 测试架构

### 2.1 测试分层

```
tests/
├── smoke/                          # 冒烟测试主目录
│   ├── helpers/
│   │   ├── agent-client.ts         # Agent Layer HTTP 客户端
│   │   ├── backend-client.ts       # Backend API HTTP 客户端
│   │   ├── backend-db.ts           # Backend DB 直查工具
│   │   ├── agent-db.ts             # Agent DB 直查工具
│   │   ├── test-context.ts         # 测试上下文管理
│   │   └── cleanup.ts             # 数据清理
│   │
│   ├── ts1-functional/             # TS-1 功能冒烟
│   │   ├── 01-health.test.ts
│   │   ├── 02-register.test.ts
│   │   ├── 03-auth.test.ts
│   │   ├── 04-account-info.test.ts
│   │   ├── 05-products.test.ts
│   │   ├── 06-session-dynamic.test.ts
│   │   ├── 07-session-static.test.ts
│   │   ├── 08-session-rotate.test.ts
│   │   ├── 09-session-renew.test.ts
│   │   ├── 10-session-terminate.test.ts
│   │   ├── 11-billing.test.ts
│   │   ├── 12-telemetry.test.ts
│   │   └── 13-stats.test.ts
│   │
│   ├── ts2-integration/            # TS-2 跨系统集成
│   │   ├── 01-register-cross.test.ts
│   │   ├── 02-dynamic-order-cross.test.ts
│   │   ├── 03-static-order-cross.test.ts
│   │   └── 04-billing-cross.test.ts
│   │
│   ├── ts3-regression/             # TS-3 回归
│   │   ├── 01-api-contract.test.ts
│   │   └── 02-error-codes.test.ts
│   │
│   ├── ts4-performance/            # TS-4 性能冒烟
│   │   ├── 01-latency.test.ts
│   │   └── 02-concurrent.test.ts
│   │
│   ├── ts5-security/               # TS-5 安全
│   │   ├── 01-auth-guard.test.ts
│   │   ├── 02-rate-limit.test.ts
│   │   └── 03-isolation.test.ts
│   │
│   ├── ts6-observability/          # TS-6 可观测性
│   │   ├── 01-api-logs.test.ts
│   │   ├── 02-health-check.test.ts
│   │   └── 03-response-format.test.ts
│   │
│   └── ts7-acceptance/             # TS-7 上线验收
│       └── 01-e2e-journey.test.ts
│
└── vitest.config.ts
```

### 2.2 辅助工具设计

#### Agent Layer HTTP 客户端 (`agent-client.ts`)

```typescript
// 封装 Agent Layer API 调用
class AgentClient {
  constructor(baseUrl: string)

  // 无需认证
  health(): Promise<ApiResponse>
  register(name: string, email?: string): Promise<{
    api_key: string; api_secret: string; agent_id: number
  }>

  // 需要认证（自动携带 X-API-Key）
  withKey(apiKey: string): AuthenticatedClient

  interface AuthenticatedClient {
    getInfo(): Promise<ApiResponse>
    getToken(apiSecret: string): Promise<JwtResponse>
    createSession(params: SessionParams): Promise<ApiResponse>
    getSession(sessionId: string): Promise<ApiResponse>
    listSessions(query?: object): Promise<ApiResponse>
    rotateSession(sessionId: string, reason?: string): Promise<ApiResponse>
    terminateSession(sessionId: string): Promise<ApiResponse>
    renewSession(sessionId: string, duration: number): Promise<ApiResponse>
    addWhitelist(sessionId: string, ips: string[]): Promise<ApiResponse>
    getBalance(): Promise<ApiResponse>
    createRecharge(amount: number): Promise<ApiResponse>
    getRechargeStatus(orderId: string): Promise<ApiResponse>
    getTransactions(query?: object): Promise<ApiResponse>
    listProducts(query?: object): Promise<ApiResponse>
    listRegions(): Promise<ApiResponse>
    reportEvent(sessionId: string, event: TelemetryEvent): Promise<ApiResponse>
    batchReport(events: TelemetryEvent[]): Promise<ApiResponse>
    getSessionHealth(sessionId: string): Promise<ApiResponse>
    getStatsOverview(): Promise<ApiResponse>
    raw(method: string, path: string, body?: object, headers?: object): Promise<Response>
  }
}
```

#### Backend 验证客户端 (`backend-client.ts`)

```typescript
// 封装 Backend API 调用用于测试验证
class BackendVerifyClient {
  constructor(baseUrl: string)

  // 以 openAgent 身份登录
  loginAsAgent(): Promise<string>

  // 以 admin 身份登录
  loginAsAdmin(): Promise<string>

  // 验证用户存在性
  verifyUser(username: string): Promise<{
    id: number; agent_id: number; agent_name: string;
    balance: number; status: string
  }>

  // 验证 openAgent 余额变化
  getAgentBalance(): Promise<number>

  // 查询动态订单
  getDynamicOrders(userId: number): Promise<DynamicOrder[]>

  // 查询静态订单
  getStaticOrders(token: string): Promise<StaticOrder[]>

  // 查询交易记录
  getTransactions(userId: number): Promise<Transaction[]>
}
```

#### Backend 数据库直查 (`backend-db.ts`)

```typescript
// 通过 Backend API 或 SQL 直接查询后端数据库
// 用于验证 Agent Layer 操作在 Backend 侧的数据正确性

interface BackendDbVerifier {
  // 查询 users 表
  findUser(username: string): Promise<{
    id: number; username: string; agent_id: number;
    agent_name: string; balance: number;
    total_recharge: number; total_consumption: number
  }>

  // 查询 dynamic_orders 表
  findDynamicOrdersByUser(userId: number): Promise<{
    order_no: string; user_id: number; agent_id: number;
    total_amount: number; status: string
  }[]>

  // 查询 static_orders 表
  findStaticOrdersByUser(userId: number): Promise<{
    order_no: string; user_id: number; agent_id: number;
    amount: number; status: string
  }[]>

  // 查询 transactions 表
  findTransactions(userId: number): Promise<{
    transaction_no: string; type: string;
    amount: number; balance: number; status: string
  }[]>

  // 查询 usdt_recharge_orders 表
  findRechargeOrder(orderId: string): Promise<{
    status: string; amount_cny: number
  }>
}
```

#### 测试上下文 (`test-context.ts`)

```typescript
// 管理测试生命周期中的共享状态
interface TestContext {
  // 注册阶段产出
  agentId: number
  apiKey: string
  apiSecret: string
  backendUsername: string   // Agent Layer 为其创建的后端用户名
  backendUserId: number     // 后端用户 ID

  // openAgent 基线
  agentBalanceBefore: number  // openAgent 测试前余额

  // Session 阶段产出
  dynamicSessionId?: string
  staticSessionId?: string
  dynamicOrderNo?: string
  staticOrderNo?: string

  // 充值阶段产出
  rechargeOrderId?: string
}
```

---

## 3. TS-1 功能冒烟测试

> 目标：验证每个 API 端点的基本正确性

### 3.1 TC-F01 健康检查

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/health` |
| **前置** | 无 |
| **步骤** | 1. 请求 `/v1/health` |
| **断言** | `success === true`，`data.status === "ok"`，`data.version` 存在，`meta.request_id` 格式 `req_*` |

### 3.2 TC-F02 Agent 注册

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/account/register` |
| **前置** | 无 |
| **步骤** | 1. 发送 `{ name: "smoke-test-{timestamp}", contact_email: "smoke@test.com" }` |
| **断言** | |
| | HTTP 201 |
| | `data.api_key` 以 `ak_` 开头，长度 >= 48 |
| | `data.api_secret` 以 `sk_` 开头，长度 >= 64 |
| | `data.status === "active"` |
| | `data.trial.is_trial === true` |
| | `data.trial.trial_balance` === env.TRIAL_BALANCE |
| **产出** | 保存 `api_key`、`api_secret`、`agent_id` 到 TestContext |

### 3.3 TC-F03 JWT Token 签发

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/auth/token` |
| **前置** | TC-F02 |
| **步骤** | 1. 用 `api_key` + `api_secret` 请求 token |
| **断言** | |
| | `data.access_token` 为 JWT 格式（3 段 base64） |
| | `data.token_type === "Bearer"` |
| | `data.expires_in === 3600` |
| | `data.agent.id === agentId` |
| | `data.agent.permissions` 含 `proxy:read`, `proxy:write`, `session:manage`, `billing:read` |

### 3.4 TC-F04 账户信息查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/account/info` |
| **前置** | TC-F02 |
| **步骤** | 1. 携带 `X-API-Key` 请求 |
| **断言** | |
| | `data.agent_id` 与注册返回一致 |
| | `data.status === "active"` |
| | `data.total_sessions === 0` |
| | `data.active_sessions === 0` |
| | `data.max_active_sessions === 100` |
| | `data.rate_limit.per_minute === 60` |
| | `data.auth_mode === "api_key_only"` |

### 3.5 TC-F05 产品列表查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/products` |
| **前置** | TC-F02 |
| **步骤** | 1. 请求全量产品 `?type=all` |
| | 2. 请求动态产品 `?type=dynamic` |
| **断言** | |
| | `data.items` 为数组且长度 > 0 |
| | 每个 item 含 `product_no`、`name`、`type`、`price`、`unit` |
| | 动态产品过滤结果中 `type` 全部为 `"dynamic"` |
| **产出** | 保存一个有效的 `product_no` 用于后续 Session 创建 |

### 3.6 TC-F06 地域列表查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/products/regions` |
| **前置** | TC-F02 |
| **步骤** | 1. 请求地域列表 |
| **断言** | |
| | `data.items` 为数组 |
| | 数组元素含 `code`、`name` |

### 3.7 TC-F07 创建动态代理 Session（异步）

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/sessions` |
| **前置** | TC-F05（获取 product_no） |
| **步骤** | |
| | 1. 发送 `{ session_type: "dynamic", product_no: "<从TC-F05>", quantity: 1, protocol: "socks5" }` |
| | 2. 断言 202 返回，`status === "creating"` |
| | 3. 轮询 `GET /v1/sessions/:session_id`，最多 30 秒，间隔 2 秒 |
| | 4. 等待 `status` 变为 `active` 或 `error` |
| **断言（创建响应）** | |
| | HTTP 202 |
| | `data.session_id` 以 `sess_` 开头 |
| | `data.status === "creating"` |
| | `data.session_type === "dynamic"` |
| **断言（就绪后）** | |
| | `data.status === "active"` |
| | `data.proxy` 对象存在且含 `host`、`port`、`protocol` |
| | `data.health.health_score === 100` |
| | `data.health.risk_level === "low"` |
| | `data.backend_order_no` 非空 |
| **产出** | 保存 `dynamicSessionId`、`dynamicOrderNo` |

### 3.8 TC-F08 创建静态代理 Session（异步）

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/sessions` |
| **前置** | TC-F05 |
| **步骤** | 与 TC-F07 类似，`session_type: "static"` |
| **断言** | |
| | 异步创建，轮询至 `active` 或 `error` |
| | 就绪后 `proxy` 含完整代理信息 |
| | `data.expires_at` 非空 |
| **产出** | 保存 `staticSessionId`、`staticOrderNo` |

### 3.9 TC-F09 Session 列表查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/sessions` |
| **前置** | TC-F07, TC-F08 |
| **步骤** | |
| | 1. 查询全部 Session |
| | 2. 查询 `?status=active` |
| | 3. 查询 `?session_type=dynamic` |
| **断言** | |
| | 分页结构正确：含 `items[]`、`pagination` |
| | 创建的 Session 出现在列表中 |
| | 过滤条件生效 |

### 3.10 TC-F10 动态代理轮换

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/sessions/:session_id/rotate` |
| **前置** | TC-F07（动态 Session） |
| **步骤** | 1. 发送 `{ reason: "http_403" }` |
| **断言** | |
| | `data.rotation.last_reason === "http_403"` |
| | `data.rotation.last_rotated_at` 非空 |
| | `data.status === "active"` |
| | `data.proxy` 信息存在（可能变化也可能不变，取决于后端） |

### 3.11 TC-F11 Session 续费

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/sessions/:session_id/renew` |
| **前置** | TC-F08（静态 Session） |
| **步骤** | 1. 发送 `{ duration: 1 }`（续费 1 天） |
| **断言** | |
| | `data.status === "active"` |
| | `data.expires_at` 大于续费前的值 |
| **备注** | 实际是否扣费取决于后端，冒烟测试仅验证 API 调用成功 |

### 3.12 TC-F12 Session 终止

| 项 | 内容 |
|----|------|
| **端点** | `DELETE /v1/sessions/:session_id` |
| **前置** | TC-F07 |
| **步骤** | 1. 终止动态 Session |
| | 2. 查询该 Session 确认状态 |
| **断言** | |
| | `data.status === "terminated"` |
| | `data.terminated_at` 非空 |
| | 再次查询 `status === "terminated"` |

### 3.13 TC-F13 余额查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/billing/balance` |
| **前置** | TC-F02 |
| **步骤** | 1. 查询余额 |
| **断言** | |
| | `data.balance` 为数字（>= 0） |
| | `data.currency` 存在 |

### 3.14 TC-F14 创建充值订单（仅创建，不支付）

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/billing/recharge` |
| **前置** | TC-F02 |
| **步骤** | 1. 发送 `{ amount: 10 }` |
| **断言** | |
| | HTTP 201 |
| | `data.order_id` 非空 |
| | `data.amount` === 10 |
| | `data.status` === "pending" 或有效状态 |
| **产出** | 保存 `rechargeOrderId` |
| **注意** | **不执行真实支付**，仅验证订单创建成功 |

### 3.15 TC-F15 充值状态查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/billing/recharge/:order_id/status` |
| **前置** | TC-F14 |
| **步骤** | 1. 查询刚创建的充值订单状态 |
| **断言** | |
| | `data.order_id` 与创建时一致 |
| | `data.status` === "pending"（未支付） |

### 3.16 TC-F16 Telemetry 单事件上报

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/sessions/:session_id/report-event` |
| **前置** | TC-F08（使用存活的静态 Session） |
| **步骤** | |
| | 1. 上报 `success` 事件：`{ event_type: "success", status_code: 200, latency_ms: 150 }` |
| | 2. 上报 `http_error` 事件：`{ event_type: "http_error", status_code: 403, target_host: "example.com" }` |
| | 3. 上报 `block` 事件：`{ event_type: "block", error_message: "IP blocked" }` |
| **断言** | |
| | 每次返回 `recorded === true` |
| | success 事件：`risk_level === "low"` |
| | http_error 事件：`risk_level === "medium"` |
| | block 事件：`risk_level === "high"` |
| | `block_probability` 递增趋势（0 → 0.2 → 0.9） |

### 3.17 TC-F17 Telemetry 批量上报

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/telemetry/batch` |
| **前置** | TC-F08 |
| **步骤** | 1. 批量上报 5 个事件（3 success + 2 http_error） |
| **断言** | |
| | `data.processed === 5` |
| | `data.results` 长度 === 5 |

### 3.18 TC-F18 Session 健康查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/sessions/:session_id/health` |
| **前置** | TC-F16（已有 telemetry 数据） |
| **步骤** | 1. 查询 Session 健康状态 |
| **断言** | |
| | `data.health_score` < 100（因为有失败事件） |
| | `data.success_rate` < 1.0 |
| | `data.total_events` > 0 |
| | `data.recommendation` 为 `ok`/`consider_rotate`/`rotate_now`/`pause` 之一 |
| | `data.recent_events` 数组非空 |

### 3.19 TC-F19 统计概览

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/stats/overview` |
| **前置** | TC-F07, TC-F08 |
| **步骤** | 1. 查询概览统计 |
| **断言** | |
| | `data.total_sessions` >= 2 |
| | `data.active_sessions` >= 0 |
| | `data.total_telemetry_events` >= 0 |

### 3.20 TC-F20 交易记录查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/billing/transactions` |
| **前置** | TC-F02 |
| **步骤** | 1. 查询交易记录 `?page=1&page_size=10` |
| **断言** | |
| | 分页结构正确 |
| | 返回数组 |

---

## 4. TS-2 跨系统集成测试

> 目标：验证 Agent Layer 操作在 Backend 侧产生正确的数据记录

### 4.1 TC-I01 注册 → Backend 用户验证

| 项 | 内容 |
|----|------|
| **前置** | TC-F02 完成 |
| **步骤** | |
| | 1. 从 Agent DB 查询新注册 Agent 的 `backend_username` |
| | 2. 以 openAgent 身份登录 Backend |
| | 3. 在 Backend 查询该用户是否存在 |
| **断言** | |
| | Backend `users` 表中存在对应用户 |
| | `agent_id === 1474`（openAgent 的 ID） |
| | `agent_name === "openAgent"` |
| | `status === "active"` 或等效值 |
| | `balance >= 0` |

### 4.2 TC-I02 动态代理开通 → Backend 订单验证

| 项 | 内容 |
|----|------|
| **前置** | TC-F07 完成（动态 Session 已 active） |
| **步骤** | |
| | 1. 从 Agent DB 获取 Session 的 `backend_order_no` |
| | 2. 以创建的 Backend 用户登录 Backend |
| | 3. 在 Backend 查询 `dynamic_orders` 表 |
| | 4. 查询 Backend 用户余额 |
| | 5. 查询 Backend `transactions` 表 |
| | 6. 查询 openAgent 的余额变化 |
| **断言** | |
| | `dynamic_orders` 存在对应订单 |
| | 订单 `user_id` 匹配该 Backend 用户 |
| | 订单 `agent_id === 1474` |
| | 订单 `status` 为有效状态 |
| | `transactions` 表有消费记录（`type` 含 consumption） |
| | Backend 用户余额已扣减 |
| | openAgent 余额已扣减（代理商分润） |

### 4.3 TC-I03 静态代理开通 → Backend 订单验证

| 项 | 内容 |
|----|------|
| **前置** | TC-F08 完成（静态 Session 已 active） |
| **步骤** | 与 TC-I02 类似，查询 `static_orders` 表 |
| **断言** | |
| | `static_orders` 存在对应订单 |
| | `user_id` 和 `agent_id` 正确 |
| | `transactions` 表有消费记录 |
| | 用户 `total_consumption` 已更新 |

### 4.4 TC-I04 充值订单 → Backend 验证

| 项 | 内容 |
|----|------|
| **前置** | TC-F14 完成 |
| **步骤** | |
| | 1. 在 Backend `usdt_recharge_orders` 表查询对应订单 |
| **断言** | |
| | 充值订单存在 |
| | `status === "pending"` |
| | `user_id` 匹配该 Backend 用户 |
| | `amount_cny` === 10 |
| **备注** | 不验证支付完成流程（避免真实扣费） |

---

## 5. TS-3 回归测试

> 目标：验证 API 响应格式未发生不兼容变更

### 5.1 TC-R01 响应格式一致性

| 检查项 | 断言 |
|--------|------|
| 所有成功响应 | 含 `success: true`, `data`, `error: null`, `meta` |
| 所有错误响应 | 含 `success: false`, `data: null`, `error.code`, `error.message` |
| `meta` 结构 | 含 `request_id`（格式 `req_*`）、`timestamp`（ISO 8601） |
| 分页响应 | 含 `items[]`、`pagination.page`、`pagination.page_size`、`pagination.total`、`pagination.total_pages` |

### 5.2 TC-R02 错误码回归

| 场景 | 请求 | 期望错误码 | 期望 HTTP |
|------|------|-----------|----------|
| 无认证访问受保护端点 | `GET /v1/account/info`（无 header） | `AUTH_INVALID_KEY` | 401 |
| 无效 API Key | `X-API-Key: invalid` | `AUTH_INVALID_KEY` | 401 |
| 无效 JWT Token | `Authorization: Bearer invalid` | `AUTH_EXPIRED_TOKEN` | 401 |
| 无效请求体 | `POST /v1/sessions` `{}` | `INVALID_REQUEST` | 400 |
| 不存在的 Session | `GET /v1/sessions/sess_nonexistent` | `SESSION_NOT_FOUND` | 404 |
| 别人的 Session | Agent B 访问 Agent A 的 Session | `SESSION_NOT_FOUND` | 404 |

---

## 6. TS-4 性能冒烟测试

> 目标：验证关键 API 响应时间在可接受范围内

### 6.1 TC-P01 延迟基准

| API | 方法 | P95 阈值 | 采样次数 |
|-----|------|---------|---------|
| `/v1/health` | GET | 500ms | 10 |
| `/v1/account/info` | GET | 1000ms | 10 |
| `/v1/sessions` | GET | 2000ms | 5 |
| `/v1/sessions/:id/report-event` | POST | 1000ms | 10 |
| `/v1/sessions/:id/health` | GET | 1500ms | 5 |

### 6.2 TC-P02 并发安全

| 场景 | 方法 | 并发数 | 断言 |
|------|------|--------|------|
| 并发查询 `/v1/account/info` | GET | 10 | 全部 200，无 500 |
| 并发上报 telemetry | POST | 20 | 全部 201，数据不丢失 |
| 并发创建 Session（同一 Agent） | POST | 3 | 不超过 `max_active_sessions` 限制 |

---

## 7. TS-5 安全测试

### 7.1 TC-S01 认证保护

| 场景 | 断言 |
|------|------|
| 无 header 访问 `/v1/account/info` | 401 + `AUTH_INVALID_KEY` |
| 无 header 访问 `/v1/sessions` | 401 + `AUTH_INVALID_KEY` |
| 无 header 访问 `/v1/billing/balance` | 401 + `AUTH_INVALID_KEY` |
| 无效 API Key | 401 + `AUTH_INVALID_KEY` |
| 已禁用 Agent 的 API Key | 403 + `ACCOUNT_DISABLED` |
| 错误 Secret 换 Token | 401 + `AUTH_INVALID_KEY` |

### 7.2 TC-S02 Rate Limit

| 场景 | 断言 |
|------|------|
| 连续快速请求 `/v1/health` 超过限额 | 收到 429 |
| 429 响应包含 `Retry-After` 头 | 头部存在且为正整数 |
| 429 响应包含 `X-RateLimit-Remaining: 0` | 头部存在 |
| 普通响应包含 `X-RateLimit-*` 头 | `Limit`、`Remaining`、`Reset` 三个头都存在 |

### 7.3 TC-S03 资源隔离

| 场景 | 断言 |
|------|------|
| Agent A 查询 Agent B 的 Session | 404 `SESSION_NOT_FOUND`（非 403） |
| Agent A 终止 Agent B 的 Session | 404 `SESSION_NOT_FOUND` |
| Agent A 上报 Agent B Session 的事件 | 404 `SESSION_NOT_FOUND` |
| Agent A 查询 Agent B 的余额 | 只返回 Agent A 自己的余额 |

### 7.4 TC-S04 敏感数据不泄漏

| 场景 | 断言 |
|------|------|
| `GET /v1/account/info` | 响应不含 `api_secret_hash`、`backend_password_enc` |
| Session 详情（非 active 状态） | 响应不含 `proxy` 信息 |
| 错误响应 | 不含内部堆栈信息 |

---

## 8. TS-6 可观测性测试

### 8.1 TC-O01 API 日志记录

| 场景 | 断言 |
|------|------|
| 执行任意认证 API 后 | Agent DB `agent_api_logs` 表有对应记录 |
| 日志包含 | `method`、`path`、`status_code`、`latency_ms`、`agent_id` |
| Health Check 不记录 | `/v1/health` 请求不出现在日志表中 |

### 8.2 TC-O02 健康检查可用性

| 场景 | 断言 |
|------|------|
| `GET /v1/health` | 响应 200，`data.status === "ok"` |
| 响应时间 | < 500ms |
| 多次连续请求 | 全部成功，无波动 |

### 8.3 TC-O03 响应元数据完整性

| 场景 | 断言 |
|------|------|
| 所有 API 响应 | 包含 `meta.request_id`，格式 `req_{16位hex}` |
| 所有 API 响应 | 包含 `meta.timestamp`，ISO 8601 格式 |
| 认证 API 响应 | 包含 `meta.latency_ms`，为正整数 |

---

## 9. TS-7 上线验收测试

> 目标：模拟 AI Agent 的完整使用旅程，端到端验证

### 9.1 TC-A01 完整使用旅程（E2E）

**场景**: 模拟一个 AI Agent 从零开始使用代理服务的完整流程

```
阶段 1: 准备
  ├─ 记录 openAgent 当前余额（baseline）
  └─ 创建测试时间戳标识

阶段 2: 注册与认证
  ├─ POST /v1/account/register
  ├─ GET /v1/account/info       → 确认注册成功
  ├─ POST /v1/auth/token        → 验证 JWT 签发
  ├─ [Backend 验证] 用户在 openAgent 名下
  └─ [Backend 验证] agent_id === 1474

阶段 3: 查询产品
  ├─ GET /v1/products           → 获取可用产品
  ├─ GET /v1/products/regions   → 获取可用地域
  └─ 选择一个动态代理产品

阶段 4: 创建代理 Session
  ├─ POST /v1/sessions (dynamic)   → 异步创建
  ├─ 轮询至 active (max 30s)
  ├─ GET /v1/sessions/:id          → 获取代理信息
  ├─ [Backend 验证] dynamic_orders 记录存在
  ├─ [Backend 验证] 用户余额已扣减
  ├─ [Backend 验证] openAgent 余额已扣减
  └─ [Backend 验证] transactions 记录正确

阶段 5: 使用代理（模拟）
  ├─ POST /v1/sessions/:id/report-event (success)
  ├─ POST /v1/sessions/:id/report-event (success)
  ├─ POST /v1/sessions/:id/report-event (http_error, 403)
  ├─ GET /v1/sessions/:id/health
  │   └─ 确认 health_score < 100, success_rate < 1.0
  ├─ POST /v1/sessions/:id/rotate (reason: http_403)
  │   └─ 确认轮换成功
  ├─ POST /v1/sessions/:id/report-event (success)
  └─ GET /v1/sessions/:id/health
      └─ 确认 health_score 回升

阶段 6: 查看账单与统计
  ├─ GET /v1/billing/balance
  ├─ GET /v1/billing/transactions
  └─ GET /v1/stats/overview
      └─ 确认 total_sessions >= 1

阶段 7: 清理
  ├─ DELETE /v1/sessions/:id    → 终止 Session
  ├─ GET /v1/sessions/:id       → 确认 terminated
  └─ 记录 openAgent 最终余额
      └─ 与 baseline 对比，差额合理
```

### 9.2 验收通过标准

| 维度 | 标准 |
|------|------|
| **功能** | TS-1 全部 PASS（TC-F01 ~ TC-F20） |
| **集成** | TS-2 全部 PASS（TC-I01 ~ TC-I04） |
| **回归** | TS-3 全部 PASS |
| **性能** | TS-4 max < 10s 硬断言，p95 < 3s 警告（不 FAIL） |
| **安全** | TS-5 全部 PASS |
| **可观测** | TS-6 全部 PASS |
| **E2E** | TS-7 完整旅程 PASS |
| **数据一致性** | Agent DB 与 Backend DB 数据匹配 |

---

## 10. 测试数据管理

### 10.1 测试数据生命周期

```
beforeAll (suite-level):
  1. 记录 openAgent 基线余额
  2. 注册 smoke-test Agent → 获取 api_key
  3. 查询可用产品 → 缓存 product_no

afterAll (suite-level):
  1. 终止所有测试创建的 Session
  2. 记录 openAgent 最终余额
  3. 输出余额变化报告
```

### 10.2 命名规范

| 资源 | 命名格式 | 示例 |
|------|---------|------|
| Agent 名称 | `smoke-{timestamp}` | `smoke-1708700000` |
| Idempotency Key | `test-{suite}-{case}-{timestamp}` | `test-ts1-f07-1708700000` |

### 10.3 数据清理策略（v1.1 增强）

- Session：测试结束统一 terminate，**带 3 次指数退避重试**
  - 重试间隔：1s → 2s → 4s
  - 仍失败则写入 `cleanup-report.json` 供人工处理
  - `creating` 状态：先 `waitForSessionReady(30s)` 再 terminate
- `TestContext.createdSessionIds[]` 追踪所有创建的 Session
- Agent 记录：保留（不影响生产，名称有前缀可识别）
- Telemetry 记录：保留（用于事后分析）
- 充值订单：保留 `pending` 状态，不执行支付，自动过期

---

## 11. 测试工具与框架

| 工具 | 用途 |
|------|------|
| **vitest** | 测试运行器（与项目已有配置一致） |
| **undici / fetch** | HTTP 客户端（调用 Agent Layer + Backend API） |
| **@prisma/client** | Agent DB 直查（验证内部数据） |
| **pg / sql** | Backend DB 直查（验证后端数据） |
| **zod** | 响应 schema 验证 |

### 11.1 vitest 配置

```typescript
// tests/vitest.config.ts
export default {
  test: {
    testTimeout: 60_000,      // 60 秒（含异步等待）
    hookTimeout: 30_000,
    sequence: { concurrent: false },  // 顺序执行
    reporters: ['verbose', 'json'],
    outputFile: 'test-results.json',
  }
}
```

---

## 12. 执行策略

### 12.1 执行顺序

```
1. TS-6 可观测性（先确认服务活着）
2. TS-1 功能冒烟（核心路径）
3. TS-2 跨系统集成（数据一致性）
4. TS-3 回归测试（API 合约）
5. TS-5 安全测试（权限隔离）
6. TS-4 性能冒烟（延迟基准）
7. TS-7 上线验收（E2E 旅程）
```

### 12.2 运行命令

```bash
# 全量冒烟测试
npm run test:smoke

# 单独执行某一套
npm run test:smoke -- --grep "TS-1"

# E2E 验收
npm run test:smoke -- --grep "TS-7"
```

### 12.3 环境变量

测试运行需要以下环境变量：

| 变量 | 说明 |
|------|------|
| `AGENT_BASE_URL` | Agent Layer 的公开 URL |
| `BACKEND_BASE_URL` | Backend 的公开 URL |
| `BACKEND_AGENT_USERNAME` | openAgent 用户名 |
| `BACKEND_AGENT_PASSWORD` | openAgent 密码 |
| `AGENT_DATABASE_URL` | Agent 数据库连接串（PUBLIC URL） |

### 12.4 跳过的测试项

| 功能 | 原因 | 标记 |
|------|------|------|
| 动态白名单 | 功能未实现 | `test.skip` |
| USDT 支付完成流程 | 避免真实扣费 | `test.skip` |
| ~~静态产品查询~~ | **v1.1 已实现** | ✅ 已移除 skip |
| Webhook 通知 | 功能未实现 | `test.skip` |
| ~~幂等键实际验证~~ | **v1.1 保留核心用例**（同 key 重复提交应返回相同结果或 409） | ✅ 已移除 skip |

### 12.5 v1.1 测试代码实际结构

```
tests/smoke/
├── setup.ts                         # 环境配置 + ALLOW_PROD 保护闸门
├── helpers/
│   ├── agent-client.ts              # Agent Layer HTTP 客户端（支持双通道认证）
│   ├── backend-verify-client.ts     # Backend API 验证客户端（含 adjustUserBalance）
│   ├── test-context.ts              # 共享状态（createdSessionIds 追踪）
│   └── cleanup.ts                   # 强一致清理（3 次重试 + cleanup-report.json）
├── global-setup.test.ts             # TS-0: 环境连通性验证
├── ts1-auth-account.test.ts         # TS-1: 注册、双通道认证、跨系统用户验证、管理员充值
├── ts2-products.test.ts             # TS-2: 动态/静态/全量产品查询、地域查询
├── ts3-sessions.test.ts             # TS-3: Session 生命周期（创建/轮询/轮换/终止）
├── ts4-telemetry.test.ts            # TS-4: Telemetry 上报、健康弱断言
├── ts5-billing.test.ts              # TS-5: 余额、充值订单、交易记录
├── ts6-security-idempotency.test.ts # TS-6: 安全、隔离、幂等核心用例
└── ts7-performance-stats.test.ts    # TS-7: 性能软断言、统计、响应结构
```

---

## 13. TS-8 指纹配置冒烟测试 (Phase 2)

> 目标：验证 Profile CRUD、指纹生成、代理绑定的基本正确性

### 13.1 TC-P01 创建浏览器配置

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/profiles` |
| **前置** | 已注册 Agent |
| **步骤** | 1. 发送 `{ name: "test-profile", fingerprint: { os: "windows", browser: "chrome" } }` |
| **断言** | |
| | HTTP 201 |
| | `data.profile_id` 以 `prof_` 开头 |
| | `data.status === "active"` |
| | `data.fingerprint.user_agent` 包含 "Chrome" 和 "Windows" |
| | `data.fingerprint.canvas_hash` 非空 |
| | `data.fingerprint.webgl_hash` 非空 |
| **产出** | 保存 `profileId` |

### 13.2 TC-P02 生成随机指纹

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/fingerprints/generate` |
| **步骤** | 1. 发送 `{ os: "windows", browser: "chrome", country: "US" }` |
| **断言** | |
| | `data.user_agent` 含 "Chrome" |
| | `data.timezone` 属于美国时区 |
| | `data.locale` 以 "en" 开头 |
| | `data.screen.width` > 0 |
| | `data.cpu_cores` > 0 |
| | 两次生成结果不同（随机性） |

### 13.3 TC-P03 配置列表查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/profiles` |
| **前置** | TC-P01 |
| **步骤** | 1. 查询全部配置 |
| | 2. 按 status=active 筛选 |
| **断言** | |
| | 分页结构正确 |
| | 创建的配置出现在列表中 |

### 13.4 TC-P04 配置详情查询

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/profiles/:profile_id` |
| **前置** | TC-P01 |
| **断言** | |
| | `data.profile_id` 匹配 |
| | `data.fingerprint` 包含完整指纹参数 |
| | `data.proxy_binding` 存在 |

### 13.5 TC-P05 更新配置

| 项 | 内容 |
|----|------|
| **端点** | `PUT /v1/profiles/:profile_id` |
| **前置** | TC-P01 |
| **步骤** | 1. 发送 `{ name: "updated-name", tags: ["test"] }` |
| **断言** | |
| | `data.name === "updated-name"` |
| | `data.tags` 含 "test" |

### 13.6 TC-P06 克隆配置

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/profiles/:profile_id/duplicate` |
| **前置** | TC-P01 |
| **步骤** | 1. 发送 `{ new_name: "cloned-profile", regenerate_fingerprint: true }` |
| **断言** | |
| | 新 `profile_id` 与原不同 |
| | `data.name === "cloned-profile"` |
| | 指纹参数与原配置不同（已重新生成） |

### 13.7 TC-P07 代理绑定

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/profiles/:profile_id/bind-proxy` |
| **前置** | TC-P01 + 已有活跃 Session |
| **步骤** | 1. 发送 `{ session_id: "sess_xxx" }` |
| **断言** | |
| | `data.proxy_binding.session_id` 匹配 |
| | `data.proxy_binding.proxy_url` 非空 |

### 13.8 TC-P08 指纹一致性校验

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/fingerprints/validate` |
| **步骤** | 1. 发送一致的指纹 + proxy_country=US |
| | 2. 发送不一致的指纹（中国时区 + US 代理） |
| **断言** | |
| | 一致场景: `data.valid === true`, `consistency_score > 90` |
| | 不一致场景: `data.valid === false` 或 warnings 非空 |

### 13.9 TC-P09 批量创建

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/profiles/batch-create` |
| **步骤** | 1. 发送 `{ count: 3, name_prefix: "batch-test", template: { os: "windows" } }` |
| **断言** | |
| | `data.created_count === 3` |
| | 每个配置有不同的指纹 |

### 13.10 TC-P10 删除配置

| 项 | 内容 |
|----|------|
| **端点** | `DELETE /v1/profiles/:profile_id` |
| **前置** | TC-P06 的克隆配置 |
| **断言** | |
| | HTTP 200 |
| | 再次查询返回 404 或 status=archived |

---

## 14. TS-9 浏览器实例冒烟测试 (Phase 3)

> 目标：验证浏览器启动、自动化、截图、关闭的基本流程

### 14.1 TC-B01 启动浏览器

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/browser/launch` |
| **前置** | TC-P01（已有 Profile） |
| **步骤** | 1. 发送 `{ profile_id: "prof_xxx", headless: true }` |
| **断言** | |
| | HTTP 201 |
| | `data.instance_id` 以 `inst_` 开头 |
| | `data.status === "running"` |
| | `data.browser_type === "chromium"` |
| **产出** | 保存 `instanceId` |
| **清理** | afterAll 关闭实例 |

### 14.2 TC-B02 导航

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/browser/instances/:id/navigate` |
| **前置** | TC-B01 |
| **步骤** | 1. 发送 `{ url: "https://httpbin.org/ip", wait_until: "networkidle" }` |
| **断言** | |
| | `data.current_url` 含 "httpbin.org" |
| | `data.status_code === 200` |

### 14.3 TC-B03 执行自动化动作

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/browser/instances/:id/execute` |
| **前置** | TC-B01 |
| **步骤** | 1. 导航到 httpbin.org |
| | 2. 执行 `[{ type: "evaluate", script: "return document.title" }]` |
| **断言** | |
| | `results` 数组长度 > 0 |
| | 每个 step 的 status === "ok" |

### 14.4 TC-B04 截图

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/browser/instances/:id/screenshot` |
| **前置** | TC-B02（已有页面内容） |
| **步骤** | 1. 发送 `{ type: "viewport", format: "png" }` |
| **断言** | |
| | `data.screenshot_url` 非空 |
| | `data.width > 0` |
| | `data.size_bytes > 0` |

### 14.5 TC-B05 Cookie 管理

| 项 | 内容 |
|----|------|
| **端点** | `GET/POST /v1/browser/instances/:id/cookies` |
| **前置** | TC-B02 |
| **步骤** | 1. 获取当前 Cookie |
| | 2. 设置自定义 Cookie |
| | 3. 再次获取验证 |
| **断言** | |
| | 设置的 Cookie 出现在获取结果中 |

### 14.6 TC-B06 关闭浏览器（保存状态）

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/browser/instances/:id/close` |
| **前置** | TC-B01 |
| **步骤** | 1. 发送 `{ save_cookies: true, save_storage: true }` |
| **断言** | |
| | HTTP 200 |
| | 再次查询实例，status 为 "closed" |
| | Profile 的 Cookie 存储已更新 |

### 14.7 TC-B07 实例列表

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/browser/instances` |
| **步骤** | 1. 启动一个浏览器 |
| | 2. 查询实例列表 |
| **断言** | |
| | 列表中包含启动的实例 |
| | 实例信息含 `memory_mb`、`status` |

---

## 15. TS-10 浏览器任务冒烟测试 (Phase 3)

### 15.1 TC-T01 提交任务

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/tasks` |
| **前置** | TC-P01（已有 Profile） |
| **步骤** | 1. 提交截图任务 |
| **断言** | |
| | HTTP 202 |
| | `data.task_id` 以 `task_` 开头 |
| | `data.status === "queued"` |
| **产出** | 保存 `taskId` |

### 15.2 TC-T02 查询任务状态

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/tasks/:task_id` |
| **前置** | TC-T01 |
| **步骤** | 1. 轮询任务状态，最多 60 秒 |
| **断言** | |
| | 最终 status 为 "completed" 或 "failed" |
| | 若 completed: `result.screenshots` 非空 |
| | `duration_ms > 0` |

### 15.3 TC-T03 取消任务

| 项 | 内容 |
|----|------|
| **端点** | `DELETE /v1/tasks/:task_id` |
| **步骤** | 1. 提交新任务 |
| | 2. 立即取消 |
| **断言** | |
| | status 变为 "cancelled"（若来得及取消） |

### 15.4 TC-T04 任务列表

| 项 | 内容 |
|----|------|
| **端点** | `GET /v1/tasks` |
| **前置** | TC-T01 |
| **断言** | |
| | 分页结构正确 |
| | 创建的任务出现在列表中 |

---

## 16. TS-11 反检测冒烟测试 (Phase 3)

### 16.1 TC-AD01 运行检测测试

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/anti-detect/test` |
| **前置** | TC-P01（已有 Profile） |
| **步骤** | 1. 发送 `{ profile_id: "prof_xxx", test_sites: ["browserleaks"] }` |
| **断言** | |
| | `data.overall_score > 0` |
| | `data.results` 非空 |
| | 无严重泄漏 (`leaked_info` 为空或长度 < 2) |
| **备注** | 弱断言：分数范围检查，不做精确值 |

### 16.2 TC-AD02 泄漏检测

| 项 | 内容 |
|----|------|
| **端点** | `POST /v1/anti-detect/check-leaks` |
| **前置** | TC-B01（运行中的浏览器实例） |
| **断言** | |
| | `data.webrtc_leak === false` |
| | `data.dns_leak === false` |

---

## 17. Phase 2/3 验收通过标准

| 维度 | 标准 |
|------|------|
| **Profile CRUD** | TS-8 TC-P01 ~ TC-P10 全部 PASS |
| **浏览器实例** | TS-9 TC-B01 ~ TC-B07 全部 PASS |
| **任务队列** | TS-10 TC-T01 ~ TC-T04 全部 PASS |
| **反检测** | TS-11 TC-AD01 ~ TC-AD02 全部 PASS |
| **指纹唯一性** | 同一模板生成的 10 个 Profile 指纹互不相同 |
| **代理一致性** | Profile 时区与绑定代理 IP 地区匹配 |
| **Cookie 持久化** | 关闭浏览器后重启，Cookie 仍在 |
| **资源释放** | 所有测试浏览器实例在 afterAll 中已关闭 |

---

*文档结束 — 请 Review 后进行测试代码编写*
