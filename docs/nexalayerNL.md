# NexaLayer 受控自然语言 Agent 系统 — 设计文档

> **版本**: v2.8
> **日期**: 2026-03-14
> **作者**: System Architect
> **状态**: Phase 13.1 (城市多编码产品匹配修复) 已完成 — Phase 14 待测试
> **依赖**: agentDesign.md v3.0, agentManual.md v1.1

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构总览](#2-系统架构总览)
3. [用户认证系统](#3-用户认证系统)
4. [落地页改造方案](#4-落地页改造方案)
5. [受控自然语言 Agent 设计](#5-受控自然语言-agent-设计)
6. [意图识别与槽位提取](#6-意图识别与槽位提取)
7. [指令执行引擎](#7-指令执行引擎)
8. [API 映射表](#8-api-映射表)
9. [对话交互设计](#9-对话交互设计)
10. [安全与权限](#10-安全与权限)
11. [技术选型](#11-技术选型)
12. [目录结构](#12-目录结构)
13. [实施路线图](#13-实施路线图)

---

## 1. 项目概述

### 1.1 背景

NexaLayer 落地页（`nexalayer-landing/`）目前是纯静态
HTML/CSS/JS 站点，仅展示产品信息和文档链接。为提升
用户体验和产品转化率，需要为落地页增加以下能力：

1. **用户认证**：登录/注册功能，与现有 ztproxy 后台
   系统共享用户体系
2. **受控自然语言 Agent**：用户通过对话框输入自然语言
   指令，系统解析并执行，返回结果

### 1.2 目标

- 用户在 NexaLayer 落地页注册/登录后，可以在 Hero 区域
  的对话框中输入自然语言指令
- 系统解析指令意图、提取关键参数，调用对应的后端 API
- 将 API 执行结果以自然语言反馈给用户
- 用户体系与 ztproxy 后台共享，同一账号可登录两个系统

### 1.3 核心原则

| 原则 | 说明 |
|------|------|
| **受控语言** | 限定意图范围，非通用 AI 对话 |
| **安全第一** | 所有操作需登录认证，权限隔离 |
| **渐进增强** | 保留原有落地页所有功能，增量添加 |
| **零歧义执行** | 关键操作需用户确认后执行 |
| **统一用户体系** | 与 ztproxy 共享用户名/密码 |

---

## 2. 系统架构总览

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│               NexaLayer 落地页 (React SPA)                 │
│  ┌────────────────┐  ┌──────────────────────────────┐    │
│  │  认证模块       │  │  NL Agent 对话框               │    │
│  │  Login/Register │  │  ┌──────────────────────────┐ │    │
│  │  AuthContext    │  │  │ 用户输入自然语言指令        │ │    │
│  └───────┬────────┘  │  │ ↓                         │ │    │
│          │           │  │ 意图识别 + 槽位提取         │ │    │
│          │           │  │ ↓                         │ │    │
│          │           │  │ 确认对话（关键操作）        │ │    │
│          │           │  │ ↓                         │ │    │
│          │           │  │ 执行引擎 → API 调用        │ │    │
│          │           │  │ ↓                         │ │    │
│          │           │  │ 结果格式化 → 返回用户       │ │    │
│          │           │  └──────────────────────────┘ │    │
│          │           └──────────────┬────────────────┘    │
└──────────┼──────────────────────────┼────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────────────────────────────────────────┐
│            NL Agent 后端服务 (NexaLayer NL API)            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 认证代理  │  │ 意图解析引擎  │  │  指令执行引擎      │   │
│  │ (Proxy)  │  │ (LLM/Rule)   │  │  (API Executor)  │   │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘   │
│       │               │                    │              │
└───────┼───────────────┼────────────────────┼──────────────┘
        │               │                    │
        ▼               ▼                    ▼
┌───────────────┐ ┌──────────┐  ┌──────────────────────┐
│ Backend API   │ │ LLM API  │  │ Agent Layer API       │
│ (ztproxy)     │ │ (OpenAI/ │  │ (Fastify)            │
│ 登录/注册/    │ │  Claude) │  │ Session/Billing/     │
│ 用户管理      │ │          │  │ Products/Stats       │
└───────────────┘ └──────────┘  └──────────────────────┘
```

### 2.2 四层语义边界（v3.8 新增）

系统在 Intent 和 API 之间引入了 **Capability（业务能力）** 层，防止意图与接口的语义错配：

```
用户输入
   ↓
Intent 识别          ← intent-parser.ts / llm-parser.ts
   ↓
Capability（业务能力） ← capability-registry.ts
   ↓
Executor 调用 API    ← executor.ts
   ↓
Formatter 输出       ← executor.ts (内联格式化)
```

**为什么需要 Capability 层？**

| 问题 | 旧架构 (Intent → API) | 新架构 (Intent → Capability → API) |
|------|----------------------|-----------------------------------|
| "显示静态代理资源"误调订单统计 | 直接绑定错误的数据字段 | Capability 定义了 `STATIC_RESOURCE_QUERY`，明确指向 `staticResources[]` |
| 新增 intent 忘记映射 | 运行时静默失败 | 启动时 `validateIntentCoverage` 校验，立即告警 |
| 审计困难 | 需逐个读 executor 函数 | `capability-registry.ts` 一表查全 |

**Capability Registry 结构**:

```typescript
interface CapabilityDef {
  intent: string;        // 意图 ID
  capability: string;    // 业务能力常量
  description: { zh: string; en: string };
  api: string;           // 绑定的 API 端点
  dataFields: string[];  // 应返回的数据字段
  phase: number;         // 所属阶段
}
```

**示例映射**:

| Intent | Capability | API | 数据字段 |
|--------|-----------|-----|---------|
| `query_static_resource` | `STATIC_RESOURCE_QUERY` | `/api/settings/prices` | `countries[].stock/name/code, totalStock` |
| `query_static_orders` | `STATIC_ORDER_LIST` | `/api/open/app/static/order/list/v2` | `order_no, region, expire_time, instances` |
| `query_transactions` | `TRANSACTION_LIST` | `/api/open/app/user/transactions` | `order_no, amount, balance, remark` |

> **实现文件**: `Agent/src/modules/nl-agent/capability-registry.ts`  
> **启动校验**: `nl.service.ts` 加载时调用 `validateIntentCoverage(Object.keys(INTENT_HANDLERS))`

### 2.3 三大核心模块

| 模块 | 职责 | 部署位置 |
|------|------|---------|
| **NexaLayer 前端** | 落地页 + 认证 UI + 对话框 | Cloudflare Pages |
| **NL Agent API** | 自然语言解析 + 指令执行 | Railway (新服务) |
| **现有后端** | 用户管理 + 业务 API | Railway (已有) |

### 2.3 NER 优先实体识别（v4.1 新增）

系统在意图匹配前引入实体识别（Named Entity Recognition）前置检查，确保包含具体实体（如 IP 地址）的输入不会被错误地路由到列表查询类意图。

#### 问题背景

```
输入: "160.250.198.41什么时候到期"
错误路由: query_expiring_ips (列表查询)
正确路由: query_ip_info (单IP查询)
```

原因：`/(?:什么时候|几号|几时).*(?:到期|过期)/i` 先于实体检查命中了 `query_expiring_ips`。

#### NER 优先规则

```
用户输入
  ↓
ruleParseIntent(text)
  ↓ 模式匹配命中 intent X
  ↓ 检查: 输入中是否包含 IP 地址实体？
  ↓   是 → 该 intent 是否已处理具体 IP？
  ↓         否 → nerPreCheck 覆盖为 query_ip_info
  ↓         是 → 保持原 intent
  ↓   否 → 保持原 intent
  ↓
（无模式匹配时也尝试 NER fallback）
```

#### IP 专属意图白名单

以下意图本身就处理具体 IP，不会被 NER 覆盖：

| 意图 | 说明 |
|------|------|
| `query_ip_info` | 查询单个IP信息 |
| `check_ip_quality` | IP质量检测 |
| `find_best_ip` | 查找最优IP |
| `find_and_evaluate_ips` | IP评估 |
| `renew_static` | 续费（可能含IP） |

#### 意图区分对照

| 输入 | 实体 | 意图 |
|------|------|------|
| "160.250.198.41什么时候到期" | IP ✓ | `query_ip_info` |
| "哪些IP快到期" | IP ✗ | `query_expiring_ips` |
| "我的IP什么时候到期" | IP ✗ | `query_expiring_ips` |
| "查询160.250.198.41" | IP ✓ | `query_ip_info` |
| "160.250.198.41" | IP ✓ | `query_ip_info` |

### 2.4 多轮对话上下文系统（v4.0 新增）

系统通过 `LastResult` + `FollowUpInfo` 实现跨轮次的上下文关联，使用户可以自然地基于上次查询结果进行后续操作。

#### 核心数据流

```
Turn 1: "英国有哪些代理"
  → intent: query_static_products
  → executor: 查询并返回 4 个产品
  → saveLastResult: 将产品列表存入 conv.lastResult

Turn 2: "帮我挑两个质量好的"
  → ruleParseIntent: unknown
  → tryFollowUp: 检测到 follow-up，type=recommend
     criteria=best_quality, quantity=2
  → intent: follow_up_recommend
  → executor: 从 lastResult.items 中排序并推荐 2 个

Turn 3: "帮我开通第1个"
  → tryFollowUp: type=action, action=purchase, indices=[1]
  → intent: follow_up_action (confirmationRequired)
  → executor: 提取第 1 个产品信息，请求确认
```

#### 状态存储（conversation-context.ts）

```typescript
interface LastResult {
  intent: string;      // 上次执行的意图
  data: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  lang: 'zh' | 'en';
  timestamp: number;   // 10 分钟有效期
}
```

#### 跟进意图类型

| 类型 | 意图 | 触发示例 | 说明 |
|------|------|----------|------|
| `select` | `follow_up_select` | "选第2个"、"要三个" | 按序号或数量选择 |
| `recommend` | `follow_up_recommend` | "挑两个最便宜的"、"哪个质量好" | 按条件推荐 |
| `action` | `follow_up_action` | "帮我开通"、"买这个" | 对选中项执行操作 |
| `refine` | `follow_up_refine` | "便宜的"、"库存最多的" | 对结果重新排序 |

#### 推荐排序策略

| criteria | 排序逻辑 |
|----------|----------|
| `cheapest` | 按 price / globalPrice 升序 |
| `best_quality` | 按 stock 降序（库存大 = 资源充足） |
| `most_stock` | 按 stock 降序 |

#### 交互示例

```
用户: 找英国IP
系统: 📦 英国静态代理产品 (4 个)：
  1. 英国-英格兰-伦敦  库存: 332  售价: ¥42
  2. 英国-英格兰-伦敦  库存: 2807  售价: ¥42
  3. 英国-英格兰-伦敦  库存: 176  售价: ¥48
  4. 英国-英格兰-伦敦  库存: 371  售价: ¥42

用户: 挑两个最便宜的
系统: 🎯 为您推荐最便宜的 2 个产品：
  1. 英国-英格兰-伦敦  库存: 332  售价: ¥42
  2. 英国-英格兰-伦敦  库存: 2807  售价: ¥42
  您可以输入：
  • "帮我开通第1个" — 购买选中的产品
  • "选第2个" — 查看详情

用户: 帮我开通第1个
系统: 📦 已为您选中产品：
  • 产品: xxx
  • 位置: 英国-英格兰-伦敦
  • 价格: ¥42
  确认开通吗？(回复"确认"执行购买)
```

---

## 3. 用户认证系统

### 3.1 统一用户体系设计

NexaLayer 和 ztproxy 共享同一个用户数据库（Backend
PostgreSQL 的 `users` 表），用户注册后可同时在两个
系统使用同一账号密码登录。

```
用户注册 (NexaLayer / ztproxy)
    │
    ├── 写入 Backend users 表
    │   ├── username (唯一)
    │   ├── password (bcrypt hash)
    │   ├── email (可选)
    │   ├── agent_id → 默认代理商
    │   └── status = 1 (active)
    │
    └── 返回 JWT Token
        ├── 同一 Token 可访问 ztproxy
        └── 同一 Token 可访问 NexaLayer NL API
```

### 3.2 认证流程

#### 3.2.1 注册

```
用户                NexaLayer 前端        Backend API
 │ 填写注册表单        │                    │
 ├──────────────────►│                    │
 │                   │ POST /api/register  │
 │                   ├───────────────────►│
 │                   │                    │ 校验用户名唯一
 │                   │                    │ bcrypt 加密密码
 │                   │                    │ 创建 users 记录
 │                   │◄───────────────────┤
 │                   │                    │
 │  注册成功          │                    │
 │  → 跳转登录        │                    │
 │◄──────────────────┤                    │
```

**注册请求参数**（v3.0 更新 — 与前端统一为邮箱注册模式）:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `email` | string (EmailStr) | ✅ | 邮箱地址，作为登录用户名 |
| `referral_code` | string | ❌ | 推荐码（绑定代理商） |

> **v3.0 变更**: 移除了 username 和 password 字段。密码由系统自动生成并发送到注册邮箱。用户名 = 邮箱地址。与前端 `src/pages/register.tsx` 保持一致。

#### 3.2.2 登录

```
用户                NexaLayer 前端        Backend API
 │ 输入用户名/密码    │                    │
 ├──────────────────►│                    │
 │                   │ POST /api/auth/login│
 │                   ├───────────────────►│
 │                   │                    │ 校验密码
 │                   │                    │ 生成 JWT Token
 │                   │◄───────────────────┤
 │                   │                    │
 │  登录成功          │                    │
 │  Token → localStorage                 │
 │  → 进入对话模式    │                    │
 │◄──────────────────┤                    │
```

**登录响应**:

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 123,
      "username": "user01",
      "email": "user@example.com",
      "is_admin": false,
      "is_agent": false,
      "balance": 100.00
    }
  }
}
```

### 3.3 Token 管理

| 项目 | 说明 |
|------|------|
| 存储位置 | `localStorage` (`auth_token`) |
| 有效期 | 7 天 (10080 分钟) |
| 携带方式 | `Authorization: Bearer <token>` |
| 刷新策略 | 过期后重新登录 |
| 跨系统 | 同一 Token 可访问 ztproxy 和 NL API |

### 3.4 前端认证状态管理

```typescript
interface AuthState {
  isAuthenticated: boolean
  user: {
    id: number
    username: string
    email?: string
    is_admin: boolean
    is_agent: boolean
    balance: number
  } | null
  token: string | null
}

interface AuthActions {
  login(username: string, password: string): Promise<void>
  register(data: RegisterData): Promise<void>
  logout(): void
  refreshUser(): Promise<void>
}
```

---

## 4. 落地页改造方案

### 4.1 技术升级方案

当前落地页为纯静态 HTML/CSS/JS，为支持认证和对话框
等动态功能，需要进行技术升级。提供两种方案：

#### 方案 A：保持静态 + 嵌入 React 微应用（推荐）

将认证模块和对话框作为独立 React 微应用，嵌入到
现有静态页面中。优势是改动最小、部署不变。

```
nexalayer-landing/
├── index.html          ← 保持不变，增加挂载点
├── styles.css          ← 保持不变，增加新样式
├── main.js             ← 保持不变
├── app/                ← 新增 React 微应用
│   ├── src/
│   │   ├── index.tsx       # 入口，挂载到 #nl-app
│   │   ├── AuthProvider.tsx
│   │   ├── ChatWidget.tsx  # 对话框组件
│   │   ├── LoginModal.tsx  # 登录弹窗
│   │   ├── RegisterModal.tsx
│   │   └── api/
│   │       ├── auth.ts
│   │       └── nlAgent.ts
│   ├── package.json
│   └── vite.config.ts
└── dist/               ← 构建产物
    └── nl-app.js       # 打包为单文件，index.html 引用
```

#### 方案 B：全面迁移为 React SPA

将整个落地页迁移为 React + Vite 应用。优势是架构
统一，但改动较大。

**推荐方案 A**，理由：
1. 最小化改动，保留 SEO 友好的静态 HTML
2. 对话框和认证作为增强功能渐进加载
3. 部署流程不变（Cloudflare Pages）
4. 首屏加载速度不受影响

### 4.2 Hero 区域改造

改造后的 Hero 区域分为左右两部分：
- **左侧**：保留原有 Hero 文案信息
- **右侧**：替换插图为对话框（登录前显示登录提示，
  登录后显示对话框）

#### 4.2.1 改造后 Hero HTML 结构

```html
<section class="hero">
  <div class="hero-inner">
    <!-- 左侧：保留原有内容 -->
    <div class="hero-text">
      <h1>The Network Execution Layer
        for AI Agents.</h1>
      <p class="hero-sub">
        Session-based networking infrastructure
        built for AI-native workloads.
      </p>
      <p class="hero-support">
        Stop managing IP pools.
        Start managing sessions.
      </p>
      <div class="hero-buttons">
        <a href="#start" class="btn btn-primary">
          Get API Key
        </a>
        <a href="https://docs.nexalayer.net"
          class="btn btn-secondary">
          View Documentation
        </a>
      </div>
      <p class="hero-trust">
        Python & Node SDK • OpenAPI
        • Cloudflare-ready
      </p>
    </div>

    <!-- 右侧：替换为对话框 React 挂载点 -->
    <div class="hero-visual" id="nl-app">
      <!-- React 微应用挂载于此 -->
      <!-- 未加载 JS 时显示 fallback -->
      <noscript>
        <img src="assets/layer-illustration.svg"
          alt="" width="400" height="280" />
      </noscript>
    </div>
  </div>
</section>
```

#### 4.2.2 对话框未登录状态

```
┌─────────────────────────────────────┐
│  🤖 NexaLayer Agent                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  │   通过自然语言管理你的        │   │
│  │   代理网络                   │   │
│  │                              │   │
│  │   • 查询 IP 库存和价格       │   │
│  │   • 创建和管理代理会话       │   │
│  │   • 查看消费和统计数据       │   │
│  │                              │   │
│  │   登录后即可使用             │   │
│  │                              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌──────────┐  ┌──────────────┐    │
│  │  登录     │  │  注册         │    │
│  └──────────┘  └──────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

#### 4.2.3 对话框已登录状态

```
┌─────────────────────────────────────┐
│  🤖 NexaLayer Agent    [user01] ▼   │
├─────────────────────────────────────┤
│                                     │
│  欢迎回来！你可以试试这些指令：      │
│                                     │
│  💡 "查询华盛顿的IP库存"            │
│  💡 "显示独享静态代理(isp)资源"      │
│  💡 "查询本月消费情况"              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 查询华盛顿有哪些IP         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🤖 华盛顿地区可用IP信息：     │   │
│  │                              │   │
│  │ 动态IP池:                    │   │
│  │ • out_dynamic_1 | ¥10/GB    │   │
│  │   库存: 充足                 │   │
│  │                              │   │
│  │ 静态IP:                      │   │
│  │ • LM_US_WA_01 | ¥50/条/月   │   │
│  │   库存: 89 条                │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  ┌──────────────────────────┐  📤  │
│  │ 输入你的指令...            │      │
│  └──────────────────────────┘      │
└─────────────────────────────────────┘
```

### 4.3 导航栏改造

在顶部导航栏右侧添加认证相关按钮：

```
未登录: [Product] [Docs] [Security] [Pricing]  [Login] [Sign Up]
已登录: [Product] [Docs] [Security] [Pricing]  [user01 ▼] [Logout]
```

### 4.4 Logo 与移动端布局优化（v3.9）

- NexaLayer Logo 视觉尺寸提升为当前的 2 倍。
- 移动端头部改为单行布局：`[Logo] [菜单栏] [GET API Key]`。
- NL 对话框默认尺寸加大：宽度与高度均提升为当前的 2 倍。
- 保持桌面端布局不变，仅调整移动端断点下的头部排版与对话框默认尺寸。

---

## 5. 受控自然语言 Agent 设计

### 5.1 设计理念

本系统采用**受控自然语言（Controlled Natural Language,
CNL）** 方案，而非通用 AI 对话。核心区别：

| 对比 | 通用 AI 对话 | 受控自然语言 |
|------|-------------|------------|
| 意图范围 | 无限 | 有限，预定义 |
| 响应来源 | LLM 生成 | API 执行结果 |
| 安全性 | 需防注入 | 白名单意图 |
| 可预测性 | 低 | 高 |
| 资源消耗 | 高（每次调 LLM） | 低（规则优先） |

### 5.2 处理流程

```
用户输入自然语言
    │
    ▼
┌─────────────────────┐
│  预处理层             │
│  • 去除冗余词          │
│  • 中英文统一          │
│  • 关键词标准化        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐    ┌────────────────────┐
│  规则引擎（优先）     │───►│ 命中已知模式        │
│  • 关键词匹配         │    │ → 直接提取意图+槽位  │
│  • 正则表达式         │    └────────────────────┘
│  • 模板匹配          │
└──────────┬──────────┘
           │ 未命中
           ▼
┌─────────────────────┐    ┌────────────────────┐
│  LLM 辅助解析        │───►│ Function Calling   │
│  • 结构化 Prompt      │    │ → 返回意图+槽位     │
│  • 意图分类           │    └────────────────────┘
│  • 参数提取           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  意图确认             │
│  • 低风险 → 直接执行   │
│  • 高风险 → 请求确认   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  执行引擎             │
│  • 映射到 API 调用    │
│  • 执行并收集结果     │
│  • 格式化响应         │
└──────────┬──────────┘
           │
           ▼
     返回用户
```

### 5.3 双层解析策略

**第一层：规则引擎**（零延迟、零成本）

对高频、格式化的指令使用正则 + 关键词匹配：

```
"查询华盛顿的IP" → { intent: "query_ip_inventory",
                      slots: { city: "Washington" } }

"帮我开通一个用户" → { intent: "create_user",
                       slots: {} }

"查询本月消费"    → { intent: "query_stats",
                       slots: { period: "month",
                                type: "cost" } }
```

**第二层：LLM 辅助**（规则未命中时降级使用）

使用 OpenAI/Claude 的 Function Calling 能力做
结构化意图识别，保证返回格式可控：

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "你是 NexaLayer 系统的指令解析器。解析用户的自然语言指令，返回结构化的意图和参数。只返回已定义的意图类型。"
    },
    {
      "role": "user",
      "content": "华盛顿现在有哪些IP，分别什么价格和库存"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "execute_command",
        "parameters": {
          "type": "object",
          "properties": {
            "intent": {
              "type": "string",
              "enum": [
                "create_user",
                "assign_balance",
                "query_ip_inventory",
                "query_stats",
                "query_dashboard",
                "create_session",
                "manage_session",
                "query_products",
                "unknown"
              ]
            },
            "slots": { "type": "object" },
            "confirmation_required": {
              "type": "boolean"
            }
          }
        }
      }
    }
  ]
}
```

---

## 6. 意图识别与槽位提取

### 6.1 支持的意图类型（v3.7 — 33 个意图）

#### 账号管理

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `assign_balance` | 分配额度 | ✅ | agent/admin | "给用户 user01 分配 100 元" |
| `reset_password` | 重置密码 | ✅ | - | "重置用户 user01 的密码" |
| `get_referral_code` | 推荐返佣说明 | ❌ | agent | "推荐给其他用户对方每次充值你将获得15％的佣金，请发送邮件至support@ztproxy.net。" |

> **v3.9 变更**: `create_user` 与 `batch_create_users` 已停用，不再对外开放。

#### 统计与仪表盘

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `query_stats` | 查询统计 | ❌ | all | "查询本月充值/消费/利润/订单" |
| `query_dashboard` | 仪表盘概览 | ❌ | all | "查询仪表盘数据" |
| `query_balance` | 查询余额 | ❌ | all | "我的余额多少" |
| `query_dynamic_resource` | 动态代理资源 | ❌ | all | "查询动态流量消耗" |
| `query_static_resource` | 显示独享静态代理(isp)资源 | ❌ | all | "显示独享静态代理(isp)资源" |
| `query_static_products` | 显示业务共享静态代理(isp)资源 | ❌ | all | "显示业务共享静态代理(isp)资源" |
| `query_user_detail` | 查询用户详情 | ❌ | agent/admin | "查询用户 user01 的统计" |
| `query_today_orders` | 今日消费查询 | ❌ | all | "今天消费了什么"、"今天都买了哪些" |

> **v3.0 变更**: 普通用户可以查询自己的统计、余额等信息（之前被权限限制拦截）。新增 `query_today_orders` 列出今天开通的所有静态/动态代理。

#### 产品与库存

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `query_static_products` | 查询静态产品 | ❌ | all | "华盛顿有哪些 IP，价格和库存" |
| `query_ip_inventory` | 查询 IP 库存 | ❌ | all | "查询洛杉矶的 IP"、"英国有哪些"、"日本有哪些" |
| `query_products` | 查询产品 | ❌ | all | "有哪些代理产品" |

> **v3.0 变更**: 支持直接使用国家/城市中文名查询，如"英国有哪些"、"日本有哪些"。

#### 订单管理

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `query_dynamic_orders` | 动态订单查询 | ❌ | all | "查询动态代理订单" |
| `query_static_orders` | 静态订单查询 | ❌ | all | "查询静态代理订单"、"查询140.99.35.213的订单" |
| `query_transactions` | 交易记录 | ❌ | all | "查询最近100条交易记录" |
| `query_expiring_ips` | 到期IP列表查询 | ❌ | all | "哪些IP快到期"、"即将到期IP" |
| `query_ip_info` | 单个IP信息查询 | ❌ | all | "160.250.198.41什么时候到期"、"查询160.250.198.41" |
| `generate_proxy_qr` | 代理二维码/链接生成 | ❌ | admin/user | "163.61.209.63 二维码"、"生成socks5链接" |

#### 用户管理（v3.6 新增增强）

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `query_users` | 查看用户列表 | ❌ | admin/agent | "查看用户列表"、"搜索用户 test01" |

> **权限控制**: 管理员可查看全部用户（过滤代理商），代理商可查看名下所有用户，普通用户无权限（返回提示信息）。
>
> **搜索支持**: 支持按用户名、代理商名、备注搜索，后端 `/api/open/app/users/list?search=xxx` 统一处理。
>
> **显示字段**: 序号、状态、用户名、角色（用户/代理商）、激活状态、余额、代理商（仅管理员）、备注、创建时间。

#### 分页控制意图（v3.6 新增）

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `paginate_next` | 下一页 | ❌ | all | "下一页"、"继续"、"next" |
| `paginate_prev` | 上一页 | ❌ | all | "上一页"、"prev" |
| `paginate_to_page` | 跳转页码 | ❌ | all | "第3页"、"page 5" |
| `paginate_change_page_size` | 修改每页条数 | ❌ | all | "每页20条"、"20 per page" |
| `paginate_view_detail` | 查看条目详情 | ❌ | all | "查看第5条详情" |

> **适用列表**: `query_static_orders`、`query_dynamic_orders`、`query_transactions`、`query_expiring_ips`、`query_dynamic_resource`、`query_users`、`query_nl_history` 这 7 个高频大列表意图。
>
> **实现机制**: 会话上下文保存 `PaginationContext`（lastListIntent, lastListSlots, currentPage, pageSize, totalCount），分页意图触发时回放上次列表查询并更新页码。
>
> **默认每页**: 10 条，可通过 "每页N条" 调整（1-100）。

#### 历史记录查询（v3.7 新增）

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `query_nl_history` | 查看对话历史 | ❌ | all | "查看我的历史记录"、"查看对话记录"、"查看用户 test01 的历史" |

> **权限控制**:
> - **管理员**: 可查看所有用户的对话历史，支持按用户名筛选（`target_user` 槽位）。
> - **代理商/用户**: 只能查看自己的对话历史。
>
> **搜索支持**: 支持按消息内容搜索（`search` 槽位），模糊匹配用户输入和系统回复。
>
> **持久化存储**: 使用 Prisma `NlChatLog` 模型，存储到 PostgreSQL `nl_chat_logs` 表。
>
> **显示字段**: 序号、用户名（仅管理员视角）、时间、意图、用户输入（截断 40 字）、系统回复（截断 60 字）。
>
> **支持分页**: 与其他列表一样，支持 "下一页"、"第N页" 等分页操作。
>
> **触发短语**: "查看历史记录"、"我的对话记录"、"历史命令"、"查看用户 xxx 的历史"、"所有用户操作记录"、"chat history"、"my log"。

#### 业务开通（购买）

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `purchase_dynamic` | 开通动态代理 | ✅ | user/agent指定用户 | "购买 10GB 动态代理" |
| `purchase_static` | 开通静态代理 | ✅ | user/agent指定用户 | "帮我开一个华盛顿的IP" |
| `purchase_ip` | 购买指定 IP | ✅ | user/agent指定用户 | "开通 167.148.72.0 的 IP，30天" |
| `create_session` | 创建代理会话 | ✅ | user/agent指定用户 | "创建会话" |
| `renew_static` | 续费静态代理 | ✅ | user/agent指定用户 | "续费 149.119.141.100，3个月" |
| `extract_dynamic` | 提取动态代理 | ❌ | user/agent指定用户 | "帮我提取一个动态链接"、"提取5个美国动态代理" |

> **v3.0 变更**:
> - `purchase_static` 当用户只指定地区（如"帮我开一个华盛顿的IP"）时，先列出该地区的IP列表供选择，而非报错。
> - 开通成功后显示代理信息（IP:端口:用户名:密码）、开通时间、到期时间。
> - 新增 `renew_static` 续费意图，支持按 IP 或订单号续费。

#### 定价管理

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `set_product_price` | 设置产品价格 | ✅ | agent/admin | "设置产品 PRD001 价格为 50 元" |

#### 指纹配置管理 (Phase 2 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `create_profile` | 创建浏览器配置 | ✅ | all | "创建一个美国 Chrome 浏览器配置" |
| `list_profiles` | 查看浏览器配置 | ❌ | all | "查看我的浏览器配置"、"配置列表" |
| `update_profile` | 修改浏览器配置 | ✅ | all | "修改配置 xxx 的 UA 为 Chrome 120" |
| `delete_profile` | 删除浏览器配置 | ✅ | all | "删除配置 xxx" |
| `duplicate_profile` | 复制浏览器配置 | ❌ | all | "复制配置 xxx" |
| `bind_proxy` | 绑定代理到配置 | ✅ | all | "给配置 xxx 绑定美国代理" |
| `generate_fingerprint` | 生成随机指纹 | ❌ | all | "生成一个 Windows Chrome 指纹" |
| `batch_create_profiles` | 批量创建配置 | ✅ | all | "批量创建 10 个美国 Chrome 配置" |

> **Phase 2 变更**: 新增 8 个指纹配置管理意图，覆盖浏览器配置的完整 CRUD 生命周期。

#### 指纹参数控制 (Phase 2 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `set_user_agent` | 设置 User-Agent | ✅ | all | "设置配置 xxx 的 UA 为 Chrome 120" |
| `set_timezone` | 设置时区 | ✅ | all | "设置时区为 EST"、"把时区改成美东时间" |
| `set_language` | 设置语言 | ✅ | all | "设置语言为英语"、"把语言改成 en-US" |
| `set_canvas` | 设置 Canvas 指纹 | ✅ | all | "设置 Canvas 为 noise 模式"、"关闭 Canvas" |
| `set_webgl` | 设置 WebGL 指纹 | ✅ | all | "设置 WebGL 为 noise 模式" |
| `set_audio` | 设置 Audio 指纹 | ✅ | all | "设置 Audio 为 noise"、"关闭 AudioContext" |
| `set_webrtc` | 设置 WebRTC | ✅ | all | "禁用 WebRTC"、"设置 WebRTC 为 fake" |
| `set_fonts` | 设置字体列表 | ✅ | all | "设置字体为 Arial, Helvetica, Verdana" |
| `set_plugins` | 设置插件列表 | ✅ | all | "设置插件为 PDF Viewer, Chrome PDF" |
| `set_client_hints` | 设置 Client Hints | ✅ | all | "设置 Client Hints 平台为 Windows" |

> **Phase 2 新增**: 10 个指纹参数精细控制意图。每个意图映射到
> `PUT /v1/profiles/:id` 的 fingerprint 子字段更新。
> 这些是指纹浏览器的核心能力，用户可逐项调整指纹参数。

#### Profile 管理扩展 (Phase 2 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `import_profile` | 导入浏览器配置 | ✅ | all | "导入浏览器配置"、"从文件导入配置" |
| `export_profile` | 导出浏览器配置 | ❌ | all | "导出配置 xxx"、"导出美国分组的配置" |
| `group_profile` | 配置分组管理 | ✅ | all | "把配置 xxx 移到美国分组"、"创建分组 test" |
| `tag_profile` | 配置标签管理 | ❌ | all | "给配置 xxx 打上 test 标签"、"添加标签" |

> **Phase 2 新增**: 4 个 Profile 管理扩展意图，补充导入导出和分组标签功能。

#### 代理管理 (Phase 2 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `add_proxy` | 添加代理 | ✅ | all | "添加代理 socks5://user:pass@1.2.3.4:1080" |
| `import_proxy` | 批量导入代理 | ✅ | all | "批量导入代理"、"导入代理列表" |
| `verify_proxy` | 测试代理 | ❌ | all | "测试代理 xxx"、"验证代理连通性" |
| `rotate_proxy` | 轮换代理 | ✅ | all | "轮换配置 xxx 的代理"、"换一个代理" |
| `list_proxy` | 查看代理列表 | ❌ | all | "查看可用代理"、"代理列表" |

> **Phase 2 新增**: 5 个代理管理意图。代理是指纹浏览器的第二核心能力，
> 用户需要添加、导入、测试、轮换外部代理（非平台代理）。

#### 一致性校验 (Phase 2 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `validate_fingerprint` | 校验指纹一致性 | ❌ | all | "检查配置 xxx 的指纹一致性"、"指纹校验" |
| `auto_match_proxy` | 自动匹配代理 | ✅ | all | "为配置 xxx 自动匹配最佳代理" |

> **Phase 2 新增**: 2 个一致性校验意图。确保 IP 地区 ↔ 时区 ↔ 语言
> 的一致性匹配是指纹浏览器说明书明确强调的关键要求。

#### 浏览器操作 (Phase 3 新增)

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `launch_browser` | 启动浏览器 | ✅ | all | "启动配置 xxx 的浏览器"、"打开浏览器" |
| `close_browser` | 关闭浏览器 | ✅ | all | "关闭浏览器 xxx"、"关闭所有浏览器" |
| `restart_browser` | 重启浏览器 | ✅ | all | "重启浏览器 xxx" |
| `batch_launch_browser` | 批量启动浏览器 | ✅ | all | "批量启动分组 A 的所有浏览器" |
| `batch_close_browser` | 批量关闭浏览器 | ✅ | all | "关闭所有浏览器"、"批量关闭" |
| `list_browsers` | 查看运行中浏览器 | ❌ | all | "查看运行中的浏览器"、"浏览器列表" |
| `navigate_to` | 浏览器导航 | ❌ | all | "用浏览器 xxx 访问 example.com" |
| `take_screenshot` | 浏览器截图 | ❌ | all | "截图浏览器 xxx"、"当前页面截图" |
| `submit_task` | 提交浏览器任务 | ✅ | all | "用配置 xxx 抓取 example.com 数据" |
| `run_script` | 运行脚本 | ✅ | all | "在浏览器 xxx 中获取页面标题"、"运行脚本" |
| `schedule_task` | 定时任务 | ✅ | all | "1 小时后截图 example.com"、"定时抓取" |
| `batch_task` | 批量任务 | ✅ | all | "批量截图这 5 个网站" |
| `query_task` | 查看任务状态 | ❌ | all | "查看任务 xxx 的状态"、"任务列表" |
| `run_detection_test` | 运行反检测测试 | ❌ | all | "检测配置 xxx 的指纹质量"、"反检测测试" |

> **Phase 3 变更**: 扩展为 14 个浏览器操作意图（原 8 个 + 新增 6 个），
> 补充重启、批量操作、脚本执行、定时任务等核心自动化能力。

#### 其他

| 意图 ID | 名称 | 需确认 | 权限 | 示例 |
|---------|------|:-----:|------|------|
| `check_ip_quality` | 检测 IP 质量 | ❌ | all | "查询 2.3.4.5 的质量" |
| `find_best_ip` | 查找最优质 IP | ❌ | all | "开通一个美国质量最好的IP" |
| `show_help` | 帮助 | ❌ | all | "帮助"、"help"、"怎么用"、"帮助 查询" |

> **v3.0 变更**: IP 质量检测改用 IPQualityScore API，结果缓存在数据库中（默认 72 小时）。新增 `find_best_ip` 意图，自动批量检测地区 IP 并排序推荐。

### 6.1.2 动态代理提取功能详情（v3.2 新增，v3.5 重构）

#### 功能描述

用户可以通过自然语言命令提取动态代理链接，支持账密提取和 API 提取两种方式。

#### 触发示例

- "帮我提取一个动态链接"
- "提取动态代理"
- "提取5个美国动态代理"
- "帮我提取动态链接"

#### 提取参数

Agent 向后端 `POST /api/business/dynamic-proxy/extract` 发送的请求体与前端 `DynamicBusiness.tsx` 一致：

| 顶层参数 | 类型 | 说明 |
|----------|------|------|
| `userId` | number | 目标用户 ID |
| `username` | string | 目标用户名 |
| `productNo` | string | 固定为 `"dynamic_ipweb"` |
| `proxyType` | number | 固定为 `104` |
| `flow` | number | `0`（提取不扣费） |
| `maxFlowLimit` | number | `0` |
| `unitPrice` | number | `0` |
| `totalAmount` | number | `0` |
| `extractConfig` | object | 提取配置（见下表） |

| extractConfig 参数 | 类型 | 默认值 | 说明 |
|-------------------|------|--------|------|
| `method` | string | `"password"` | 提取方式：`password`（账密）/ `api` |
| `protocol` | string | `"socks5"` | 协议：`socks5` / `http` |
| `dataFormat` | string | `"txt"` | 数据格式：`txt` / `json` |
| `delimiter` | number | `1` | 分隔符：1=CRLF, 2=BR, 3=CR, 4=LF, 5=TAB |
| `quantity` | number | `1` | 提取数量（1-1000） |
| `validTime` | number | `5` | 有效时长（分钟） |
| `timeMode` | string | `"specified"` | 时长模式：`specified`（粘贴模式）/ `change_request`（轮转模式） |
| `ipwebCountry` | string | 可选 | IPWEB 国家代码，**使用 ISO2（2位）代码**，如美国=`US`、英国=`GB`、日本=`JP`。Agent 内部会自动将 ISO3（`USA/GBR/JPN`）和中文（`美国/英国`）转换为 ISO2。留空表示全球随机。 |
| `ipwebState` | string | 可选 | IPWEB 州名（仅美国等有州的国家适用） |
| `ipwebCity` | string | 可选 | IPWEB 城市名 |

> **重要**: 动态提取场景的国家代码与其他意图（如 query_ip_inventory 使用 ISO3 `USA`）不同，必须使用 ISO2（`US`）。
> 这与后端 `proxy_service.py` 的 `IPWEB_COUNTRY_MAP`（返回 ISO2）和前端 `DynamicBusiness.tsx`（传中文国名由后端转换）一致。

#### 返回信息

- 用户名
- 提取方式（账密/API）
- 提取数量
- 有效时长
- 代理信息（默认 `host:port:user:pass` 格式，与前端 `ProxyFormat.HOST_PORT_USER_PASS` 一致）

#### 输出格式说明

后端 `_format_proxy_info` 返回 `用户名:密码@主机:端口` 格式。
Agent 在展示时自动转换为前端默认格式 `主机:端口:用户名:密码`（即 `host1.ztproxy.net:6666:账号_custom_zone_US_st_city_sid_xxxxxxxx_time_5:defaultpwd`）。

前端支持三种格式（用户可切换），Agent 默认使用第一种：
- `host:port:user:pass`（默认）
- `user:pass:host:port`
- `user:pass@host:port`

### 6.1.3 到期IP查询功能详情（v3.2 新增）

#### 功能描述

用户可以查询即将到期的静态代理IP，系统按到期时间排序，默认显示最快到期的 5 个。

#### 触发示例

- "我的哪些IP快到期了"
- "哪些IP要过期了"
- "哪些IP即将到期"

#### 返回信息

对于每个即将到期的IP，显示：
- 代理信息（IP:端口:用户名:密码）
- 到期时间
- 所属订单号

### 6.1.4 静态订单查询模式扩展（v3.2 更新）

新增以下识别模式：
- "我有哪些静态订单"
- "我买过哪些静态订单"
- "我买过哪些IP"

这些表达均正确映射到 `query_static_orders` 意图。

### 6.1.5 列表分页系统（v3.6 新增）

#### 设计目标

所有高频大列表不再一次性全部输出，而是分页展示，每页默认 10 条，底部附带分页控制提示。

#### 适用的 8 个列表意图

1. `query_static_orders` — 静态代理订单
2. `query_dynamic_orders` — 动态代理订单
3. `query_transactions` — 交易记录 / 消费记录
4. `query_expiring_ips` — 到期IP列表
5. `query_dynamic_resource` — 动态消耗详情（子账户）
6. `query_users` — 用户列表
7. `query_nl_history` — NL 对话历史
8. `query_ip_inventory` — **IP 库存列表（v3.7 新增）**

#### 分页上下文（PaginationContext）

```typescript
interface PaginationContext {
  lastListIntent: string;
  lastListSlots: Record<string, unknown>;
  lastListLang: 'zh' | 'en';
  currentPage: number;
  pageSize: number;
  totalCount: number;
}
```

每次列表查询执行后，系统自动保存分页上下文到会话中，后续分页操作（下一页、上一页、跳转页码、修改每页条数）时恢复上下文并回放查询。

#### 分页控制意图

| 意图 | 触发词 | 行为 |
|------|--------|------|
| `paginate_next` | 下一页、继续、往后翻、后面还有吗、看后面的、next、more | currentPage + 1 |
| `paginate_prev` | 上一页、往前翻、返回上一页、prev、back | currentPage - 1 |
| `paginate_to_page` | 第N页、跳到第N页、去第N页、page N | 跳转到 N |
| `paginate_change_page_size` | 每页N条、一页显示N个、多显示一点、N per page | 修改 pageSize 并回到第 1 页 |
| `paginate_view_detail` | 看第N个、查看第N条详情、show item N | 显示当前页第 N 条 |

#### 分页页脚格式

所有列表输出底部统一追加：

```
━━━━━━━━━━━━━━━━━━━━━━━━
当前显示第 1 页（第 1-10 条），共 83 条记录，9 页。
可输入：
- "下一页" / "继续"
- "上一页"
- "第N页"（如 "第3页"）
- "每页20条"
- "查看第5条详情"
```

#### 交互示例

```
用户: 查询静态代理订单
系统:
📦 静态代理订单（第 1 页）

1. STA20260310082542iu8ewi  |  美国-华盛顿  |  30天  |  到期: 2026-04-10
   149.119.141.100:8000:user1:pwd1
2. STA20260310091234abcd12  |  美国-纽约  |  30天  |  到期: 2026-04-10
   167.148.72.5:8000:user2:pwd2
...
10. STA20260310175555mnop78  |  日本-东京  |  30天  |  到期: 2026-04-10
    45.88.12.3:8000:user10:pwd10

━━━━━━━━━━━━━━━━━━━━━━━━
当前显示第 1 页（第 1-10 条），共 83 条记录，9 页。
可输入：
- "下一页" / "继续"
- "第N页"（如 "第3页"）
- "每页20条"
- "查看第5条详情"

用户: 下一页
系统:
📦 静态代理订单（第 2 页）
11. ...
...
20. ...

━━━━━━━━━━━━━━━━━━━━━━━━
当前显示第 2 页（第 11-20 条），共 83 条记录，9 页。
可输入：
- "下一页" / "继续"
- "上一页"
- "第N页"（如 "第3页"）
- "每页20条"
```

#### IP 库存分页（v3.7 新增）

`query_ip_inventory` 正式纳入统一分页系统。此前 IP 列表会一次性输出，超过 60 条时以 "...还有 N 个IP段" 截断。现在改为默认每页 10 条，支持完整分页导航。

**输出格式**：

```
用户: 都有哪些IP
系统:
📦 全部静态代理产品 (548 个IP段，第 1 页)：

美国-纽约 [纯净静态8]
1. 149.119.141.0 库存：251；成本：¥1.20；售价：¥1.50
2. 167.148.72.0 库存：200；成本：¥1.30；售价：¥1.60
...
10. 45.88.12.0 库存：150；成本：¥1.10；售价：¥1.40

━━━━━━━━━━━━━━━━━━━━━━━━
当前显示第 1 页（第 1-10 条），共 548 条记录，55 页。
可输入：
- "下一页" / "继续"
- "第N页"（如 "第3页"）
- "每页20条"
- "查看第5条详情"

用户: 下一页
系统:
📦 全部静态代理产品 (548 个IP段，第 2 页)：
11. ...
...
20. ...
```

**多轮上下文**：

```
用户: 查纽约有哪些IP     → 分页显示纽约IP
用户: 下一页              → 继续翻页纽约结果
用户: 开通第三个          → 基于当前页第 3 条操作
```

**上下文重置规则**：
- 新的地区查询（如 "英国的呢"）重置分页上下文
- 非列表操作（如 "查余额"）不破坏已有分页上下文
- 帮助命令不影响分页上下文

**边界处理**：
- 第一页输入"上一页" → "已经是第一页了"
- 最后一页输入"下一页" → "已经是最后一页了"
- 超出范围的页码 → 提示实际页数范围
- 超出当前页的序号 → 提示当前页有多少条

**模糊表达识别**：
- "继续"、"往后翻"、"后面还有吗" → 下一页
- "往前翻"、"返回上一页" → 上一页
- "多显示一点"、"展示多一点" → 增大每页条数
- "看第5个"、"查看第3条" → 查看详情

### 6.1.6 列表显示信息丰富化（v3.6 新增）

#### 交易记录显示字段

参考前端 `src/pages/dashboard/index.tsx` 的 `transactionColumns`：

| 序号 | 字段 | 说明 |
|------|------|------|
| 1 | 订单号 (order_no) | 完整订单号 |
| 2 | 用户名 (user_name) | 管理员/代理商可见 |
| 3 | 类型 (type) | 充值/消费/退款/调整等 |
| 4 | 金额 (amount) | 正值为收入，负值为支出 |
| 5 | 余额 (balance) | 交易后余额 |
| 6 | 备注 (remark) | 交易备注说明 |
| 7 | 创建时间 (created_at) | 格式 YYYY-MM-DD HH:mm:ss |

#### 动态消耗详情显示字段

参考前端 `src/pages/dashboard/index.tsx` 的子账户列表：

| 序号 | 字段 | 说明 |
|------|------|------|
| 1 | 用户名 (username) | 子账户用户名 |
| 2 | 类型 (account_type) | 主账户/子用户 |
| 3 | ID | 账户 ID |
| 4 | 总流量 (limit_flow_mb) | 转换为 GB 显示 |
| 5 | 剩余流量 | 总量 - 下载 - 上传，转换为 GB |
| 6 | 下载流量 (download_flow_mb) | 转换为 GB |
| 7 | 上传流量 (upload_flow_mb) | 转换为 GB |
| 8 | 状态 (status_text) | 正常/停用 |

#### 用户列表显示字段

参考前端 `src/pages/users/index.tsx` 的用户表格列：

| 序号 | 字段 | 说明 |
|------|------|------|
| 1 | 状态 (status) | ✅ 启用 / ⛔ 禁用 |
| 2 | 用户名 (username) | 用户登录名 |
| 3 | 角色 | 代理商 / 用户 |
| 4 | 激活状态 (is_activated) | 已激活 / 未激活 |
| 5 | 余额 (balance) | 账户余额 |
| 6 | 代理商 (agent_name) | 仅管理员可见 |
| 7 | 备注 (remark) | 用户备注 |
| 8 | 创建时间 (created_at) | 格式 YYYY-MM-DD |

> **权限控制**: 管理员查看全部用户，代理商查看名下用户，普通用户返回权限不足提示。
>
> **搜索能力**: 支持通过用户名、代理商名称、备注搜索（后端 `search` 参数统一处理）。

#### 静态订单显示格式优化

每条订单显示为紧凑的单行格式：`序号. 订单号 | 地区 | 时长 | 到期时间`，下方最多展示 3 个代理实例。

#### 动态订单显示格式优化

每条订单显示为单行：`序号. 订单号 | 状态 | 流量 | 用户名 | 创建时间`。

### 6.1.7 内建帮助系统（v3.4 新增）

#### 设计理念

帮助系统是一个 **Help Resolver**，而非静态说明书。它根据上下文动态生成帮助内容，解决 4 类问题：

1. **用户主动问帮助** → 显式帮助（按角色展示可用命令）
2. **命令没识别出来** → 智能关键词匹配，推荐相关命令
3. **意图识别了但缺参数** → 参数引导 + 具体示例
4. **执行失败** → 失败恢复建议 + 下一步操作

#### 触发方式

| 触发条件 | 帮助类型 | 示例 |
|---------|---------|------|
| 用户输入"帮助/help/怎么用" | 显式帮助 | `show_help` |
| 用户输入"帮助 查询" | 分类帮助 | `show_help` + topic |
| 意图识别为 `unknown` | 关键词推荐 | `helpForUnknown` |
| 权限检查失败 | 替代操作 | `helpForPermissionDenied` |
| 执行器返回错误 | 恢复建议 | `helpForFailure` |

#### 角色感知

帮助内容根据用户角色（管理员/代理商/用户）过滤，只展示该角色有权限执行的命令：

- **用户**：查询类 + 业务开通 + IP质量 + 重置密码
- **代理商**：以上 + 分配额度 + 推荐返佣说明 + 设置价格
- **管理员**：全部查询 + 设置价格 + 分配额度 + 重置密码
- **用户帮助额外限制**：用户帮助与默认建议中不展示
  “创建新的代理账户 / 批量创建用户 / 获取我的推荐码”，
  但代理商与管理员仍保留这些功能与帮助入口。

#### 未识别意图的智能推荐

当意图无法识别时，系统分析输入关键词，匹配到相关功能分类并推荐：

```
用户输入: "我想看看余额相关"

🤔 您似乎想进行「查询余额」相关操作，以下是可用的命令：

• 查询余额: "查询余额"
• 查询统计: "查询本月消费"
• 查询交易记录: "查询最近100条交易记录"
...

💡 输入 "帮助" 查看所有可用命令
```

#### 执行失败恢复

业务操作失败时，附带针对性恢复建议：

```
开通失败: IP不可用

💡 可以尝试：
  • 查询该地区可用的IP: "查询华盛顿的IP"
  • 确认IP可用性: 最后一位非0表示指定IP
  • 检查余额是否充足: "查询余额"
```

#### 权限不足引导

权限不足时，说明所需权限并推荐可用操作：

```
🔒 「创建用户」需要 代理商 权限。

您当前是 用户 角色。

以下是您可以执行的操作：
• 重置密码: "重置密码"
• 查询余额: "查询余额"
...
```

#### 实现文件

- `Agent/src/modules/nl-agent/help-resolver.ts` — Help Resolver 核心模块
  - `showHelp()` — 显式帮助（角色感知，支持分类筛选）
  - `helpForUnknown()` — 未识别意图帮助（关键词匹配推荐）
  - `helpForMissingParams()` — 缺少参数帮助（意图专属示例）
  - `helpForPermissionDenied()` — 权限不足帮助（替代操作推荐）
  - `helpForFailure()` — 失败恢复帮助（恢复步骤建议）

### 6.1.8 对话历史记录功能（v3.7 新增）

#### 设计目标

1. **用户回溯**: 用户可随时查看自己过去的输入和系统回复。
2. **管理员审计**: 管理员可查看所有用户的操作记录，了解系统使用情况，优化意图识别。
3. **持久化**: 所有 NL 交互自动保存到数据库，不受会话过期（30分钟 TTL）影响。

#### 数据模型

**表名**: `nl_chat_logs`（Prisma 模型: `NlChatLog`）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BigInt (PK) | 自增主键 |
| user_id | Int | 用户 ID |
| username | VarChar(100) | 用户名 |
| conversation_id | VarChar(50) | 会话 ID |
| user_message | Text | 用户输入 |
| assistant_message | Text | 系统回复 |
| intent | VarChar(80) | 识别的意图 |
| confidence | Decimal(3,2) | 置信度 |
| slots | JSONB | 提取的槽位 |
| is_admin | Boolean | 是否管理员 |
| is_agent | Boolean | 是否代理商 |
| created_at | Timestamptz | 创建时间 |

**索引**: `(user_id, created_at DESC)`、`(created_at DESC)`、`(intent)`、`(username)`

#### 持久化机制

- 在 `nl.service.ts` 的 `execute()` 入口统一保存，使用 fire-and-forget 模式（`void saveNlChatLog()`）不阻塞响应。
- 分页导航意图（`paginate_*`）不单独保存记录，避免产生大量无意义日志。
- `confirm()` 方法中确认/取消操作也会保存，用户消息格式为 `[确认] intent_name` 或 `[取消] intent_name`。

#### API 端点

**GET** `/v1/nl/history`（需要 Bearer Token 认证）

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认 1 |
| page_size | number | 每页条数，默认 20，最大 100 |
| user_id | number | 按用户 ID 筛选（仅管理员） |
| username | string | 按用户名筛选（仅管理员） |
| search | string | 按消息内容模糊搜索 |
| intent | string | 按意图筛选 |
| start_date | string | 起始时间 |
| end_date | string | 结束时间 |

**权限**: 管理员可使用 `user_id` 和 `username` 参数查看其他用户的历史；非管理员只能查看自己的历史。

#### 交互示例

**用户查看自己的历史**:
```
用户: 查看我的历史记录
系统:
📜 我的对话历史（第 1 页）

1. 2026-03-12 14:30
   意图: query_balance
   用户: 查询余额
   系统: 💰 当前余额: ¥1,234.56...

2. 2026-03-12 14:25
   意图: query_static_orders
   用户: 查看静态代理订单
   系统: 📦 静态代理订单（第 1 页）...

━━━━━━━━━━━━━━━━━━━━━━━━
当前显示第 1 页（第 1-10 条），共 56 条记录，6 页。
可输入：
- "下一页" / "继续"
- "第N页"
```

**管理员查看特定用户历史**:
```
用户: 查看用户 test01 的历史记录
系统:
📜 用户 test01 的对话历史（第 1 页）

1. [test01] 2026-03-12 14:30
   意图: purchase_dynamic
   用户: 帮我开通 5GB 动态代理
   系统: 确认开通动态代理？...
```

**管理员查看所有用户历史**:
```
用户: 查看所有用户的操作记录
系统:
📜 所有用户对话历史（第 1 页）

1. [admin] 2026-03-12 15:00
   意图: query_dashboard
   用户: 查看仪表盘
   系统: 📊 仪表盘概览...
```

#### 实现文件

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | 新增 `NlChatLog` 模型 |
| `prisma/migrations/20260312000000_add_nl_chat_logs/` | 数据库迁移 SQL |
| `nl-history.service.ts` | 新增：保存和查询历史记录 |
| `nl.service.ts` | 修改：在 execute() 和 confirm() 中持久化 |
| `nl.controller.ts` | 新增：handleHistory 处理器 |
| `nl.routes.ts` | 新增：GET /history 路由 |
| `intent-parser.ts` | 新增：query_nl_history 意图模式 |
| `executor.ts` | 新增：executeQueryNlHistory 执行器 |
| `help-resolver.ts` | 新增：history 类别和命令 |
| `conversation-context.ts` | 更新：PAGINATED_INTENTS 添加 query_nl_history |

### 6.1.9 IP 质量多源检测功能详情（v3.3 重构）

#### 信息源

系统同时调用 5 个权威信息源（并发请求），各源特点和优势：

| 信息源 | KEY 配置 | 核心能力 | 权重 |
|--------|----------|----------|------|
| **IPQualityScore** | `IPQUALITYSCORE_KEY` | 欺诈评分、代理/VPN/TOR/Bot 检测 | 40% |
| **AbuseIPDB** | `ABUSEIPDB_KEY` | 滥用举报数据库、社区举报置信度 | 25% |
| **VirusTotal** | `VIRUSTOTAL_KEY` | 恶意软件/可疑行为多引擎扫描 | 20% |
| **IPinfo** | `IPINFO_KEY` | 精准地理定位、隐私检测（VPN/代理/托管） | 辅助 |
| **IP2Location** | `IP2LOCATION_KEY` | 地理定位、IP类型、代理检测 | 辅助 |

> 如某个源的 KEY 未配置或查询失败，系统自动跳过该源，不影响其他源的结果。

#### 综合评分算法

综合评分 (composite_score) = 加权平均，0-100 分，越低越好：

```
weighted_score = 
    IPQualityScore fraud_score × 0.40
  + AbuseIPDB confidence_score × 0.25
  + VirusTotal malicious_ratio × 0.20
  + 风险标志惩罚 × 0.15
```

风险标志惩罚：每命中一个标志（is_proxy / is_vpn / is_tor / is_bot / recent_abuse）+25分，上限 100。

#### 推荐等级

| 综合评分范围 | 风险等级 | 推荐等级 | 含义 |
|:----------:|:-------:|:-------:|------|
| 0-19 | 🟢 低 | 🟢 优秀 | IP 质量极佳，强烈推荐采购 |
| 20-39 | 🟢 低 | 🟢 良好 | IP 质量良好，推荐采购 |
| 40-59 | 🟡 中 | 🟡 一般 | IP 质量一般，谨慎使用 |
| 60-79 | 🟠 高 | 🟠 较差 | IP 存在风险，不建议采购 |
| 80-100 | 🔴 高 | 🔴 不推荐 | IP 高风险，强烈不推荐 |

#### 综合报告展示内容

```
🔍 IP 综合质量报告: 2.3.4.5
━━━━━━━━━━━━━━━━━━━━━━━━

📊 综合评估
  综合评分: 15.2/100 (越低越好)
  风险等级: 🟢 低风险
  采购建议: 🟢 优秀

🚩 风险标志: 无

📈 各源评分
  IPQualityScore 欺诈分: 12/100
  AbuseIPDB 滥用置信度: 3% (举报2次)
  VirusTotal: 0个恶意 / 0个可疑

🌐 网络信息
  ISP: Example ISP
  ASN: 12345
  组织: Example Org
  IP类型: isp
  位置: US / California / Los Angeles

📋 信息来源: IPQualityScore / AbuseIPDB / VirusTotal / IPinfo / IP2Location
⏱ 查询时间: 2026-03-02T10:30:00
```

#### 检测流程

1. 用户输入 "查询 X.X.X.X 的质量"
2. 系统先查数据库缓存（`ip_quality_cache` 表），未过期则直接返回
3. 缓存未命中则并发调用 5 个信息源 API
4. 聚合各源数据：检测标志取并集（任一源报告即标记），地理/ISP 按优先级补全
5. 计算综合评分和推荐等级
6. 结果存入数据库，设置过期时间（默认 72 小时）
7. 格式化展示综合质量报告

#### 查找最优 IP 流程

1. 用户输入 "开通一个美国质量最好的IP"
2. 系统提示：此功能需要多次查询 5 个第三方 API，可能产生费用
3. 查询该地区静态 IP 列表（按价格排序）
4. 取前 5 个 IP 段的代表 IP 进行多源质量检测
5. 按 composite_score（综合评分）从低到高排序
6. 展示最优 IP 的详细综合报告 + 所有结果排名
7. 提供快捷开通建议

#### 后端 API

- `GET /api/ip-quality/check?ip=X.X.X.X` — 单个 IP 多源检测（支持 `skip_cache=true`）
- `POST /api/ip-quality/batch` — 批量检测（最多 10 个，`{ "ips": ["1.2.3.4", ...] }`）

#### 数据库字段（ip_quality_cache 表，v3.3 扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `composite_score` | FLOAT | 综合评分 0-100 |
| `recommendation` | VARCHAR(20) | 推荐等级 excellent/good/fair/poor/bad |
| `fraud_score` | FLOAT | IPQualityScore 欺诈评分 |
| `abuse_score` | FLOAT | AbuseIPDB 滥用置信度 |
| `abuse_reports` | INTEGER | AbuseIPDB 举报次数 |
| `vt_malicious` | INTEGER | VirusTotal 恶意检测数 |
| `vt_suspicious` | INTEGER | VirusTotal 可疑检测数 |
| `is_datacenter` | BOOLEAN | 是否数据中心IP |
| `ip_type` | VARCHAR(50) | IP类型（residential/datacenter/mobile等） |
| `sources_used` | VARCHAR(200) | 使用的信息源（逗号分隔） |

### 6.1.1 意图消歧机制（v3.1 新增）

当用户输入同时包含"动作词"（开通/购买/买）和"回溯/查询信号"时，系统会自动消歧，**查询优先于购买**。

#### 消歧信号

| 信号类型 | 关键词 | 判定结果 |
|---------|--------|---------|
| 过去时态标记 | 了、过、的（动词后） | → 查询 |
| 疑问词 | 哪些、什么、多少 | → 查询 |
| 回溯时间词 | 最近、昨天、上周、近期 | → 查询 |
| 传递动词 | 发给我、给我、列出、列表 | → 查询 |
| 查询动词 | 查、查询、查看、看看 | → 查询 |
| 祈使+数量 | 开通一个、买一个、开5个 | → 购买 |
| 直接请求 | 帮我开、帮忙开、我要开通 | → 购买 |

#### 消歧示例

| 用户输入 | 正确意图 | 原因 |
|---------|---------|------|
| "把我昨天开通的IP发给我" | `query_static_orders` | "开通的"=过去时，"发给我"=查询传递 |
| "我最近开通了哪些IP" | `query_static_orders` | "了"=过去时，"哪些"=疑问词 |
| "查一下我最近开通的IP" | `query_static_orders` | "查"=查询动词 |
| "帮我开通一个华盛顿的IP" | `purchase_static` | 祈使句，无回溯信号 |
| "开通一个167.148.72.0" | `purchase_ip` | 直接购买请求+具体IP |

#### 实现机制

1. **规则层预处理**：`isRetrospectiveQuery()` 函数检测回溯查询信号，如命中则跳过所有购买类意图
2. **模式顺序**：`INTENT_PATTERNS` 中查询类优先于购买类
3. **LLM 层消歧**：System Prompt 明确列出消歧规则和示例

### 6.1.1a 订单 vs 消费/交易 意图消歧（v4.1 新增）

系统严格区分"订单"和"交易/消费"两类语义：

- **订单**（`query_static_orders` / `query_today_orders`）= 用户开通了什么资源
- **交易/消费**（`query_transactions`）= 账户发生了什么扣费/流水

#### 优先级规则

| 规则 | 条件 | 跳过意图 | 命中意图 |
|------|------|---------|---------|
| 静态订单优先 | 文本含"静态/代理/IP" + "订单/开通/购买" | `query_today_orders`, `query_stats` | `query_static_orders` |
| 交易记录优先 | 文本含"消费记录/交易记录/消费流水/交易流水/账单" | `query_today_orders` | `query_transactions` |
| 交易 > 统计 | 交易记录关键词 + 无周期聚合词(本月/上月等) | `query_stats` | `query_transactions` |
| 周期聚合保留 | 交易记录关键词 + 有周期聚合词 | — | `query_stats` |
| 消费 > NL历史 | 消费类关键词 + 无显式NL历史词 | `query_nl_history` | `query_transactions` |

#### 消歧示例

| 用户输入 | 正确意图 | 原因 |
|---------|---------|------|
| "今天开通的静态代理订单" | `query_static_orders` | "开通" + "静态" + "订单" = 订单查询 |
| "我今天开通了哪些静态代理" | `query_static_orders` | "开通了" + "静态代理" = 订单查询 |
| "今天的消费记录" | `query_transactions` | "消费记录" = 交易流水 |
| "今日交易记录" | `query_transactions` | "交易记录" = 交易流水 |
| "今天的静态代理消费" | `query_transactions` | "静态" + "消费"(非订单) = 交易流水 |
| "最近开通的静态代理订单" | `query_static_orders` | "开通" + "静态" + "订单" = 订单查询 |
| "本月消费记录" | `query_stats` | "本月" = 周期聚合 → 统计 |
| "今天的订单" | `query_today_orders` | 无"静态"限定 → 今日综合订单 |

#### 时间修饰词继承

`query_static_orders` 和 `query_transactions` 支持 `period` 和 `date_range` 槽位：
- `period=day`：今天/今日/today → 自动添加 start_date/end_date
- `date_range`：具体日期范围 → 直接传递给后端

### 6.1.2 未识别意图的 LLM 对话回退（v3.0 新增）

当规则引擎和 LLM 意图解析均无法识别用户意图时，系统将使用 LLM 进行自由对话回复：

- 可回答 IP 代理相关的一般性问题（代理类型、使用场景、协议等）
- **不会推荐竞品**或引导用户使用其他代理服务商
- 回复末尾会建议 2-3 个相关的 NexaLayer 命令
- 优先使用 DeepSeek，失败后回退到 OpenAI
- 若 LLM 也不可用，则显示操作建议列表

#### 多轮跟进意图（v4.0 新增）

| 意图 | 说明 | 示例输入 | 前置条件 |
|------|------|----------|----------|
| `follow_up_select` | 选择上次结果中的项目 | "选第2个"、"要三条" | lastResult 存在 |
| `follow_up_recommend` | 按条件推荐 | "挑两个最便宜的"、"哪个质量好" | lastResult 存在 |
| `follow_up_action` | 对结果执行操作 | "帮我开通"、"买第1个" | lastResult 存在 |
| `follow_up_refine` | 重新排序/筛选 | "便宜的优先"、"库存最多的" | lastResult 存在 |

检测优先级：`ruleParseIntent` → `tryFollowUp` → `resolveReference` → `llmParse`

### 6.2 槽位定义

#### create_user（已停用）

该意图已停用，不再允许通过 NL 创建用户或代理商账号。

#### assign_balance（分配额度）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `target_user` | string | ✅ | 目标用户名 |
| `amount` | number | ✅ | 额度金额（元） |

**示例解析**:

```
输入: "帮我给用户 user01 分配 100 元额度"
→ { intent: "assign_balance",
    slots: { target_user: "user01",
             amount: 100 } }
```

#### query_ip_inventory（查询 IP 库存）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `city` | string | ❌ | 城市名 |
| `country` | string | ❌ | 国家名/代码 |
| `type` | string | ❌ | static / dynamic / all |

**示例解析**:

```
输入: "华盛顿现在有哪些 IP，分别什么价格和库存"
→ { intent: "query_ip_inventory",
    slots: { city: "USA0DC",
             country: "USA" } }

输入: "查询纽约的IP"
→ { intent: "query_ip_inventory",
    slots: { city: "USA0NY",
             country: "USA" } }

注意: geo-mapping 将自然语言地名映射为数据库编码
      (纽约→USA0NY, 华盛顿→USA0DC, 洛杉矶→USA0CALAX)
      产品查询使用 /api/settings/prices (GET) 获取全部产品后
      在客户端用前缀匹配(startsWith)过滤
```

#### query_stats（查询统计 — v2.0 增强）

| 槽位 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|-------|------|
| `type` | string | ✅ | overview | recharge/consumption/orders/profit/overview |
| `period` | string | ❌ | month | today/month/last_month/all |
| `target_user` | string | ❌ | self | 代理商可查询名下用户 |

**type 映射关系**:
- `recharge` — 充值统计（累计/本月/上月/今日）
- `consumption` — 消费统计（累计/本月/上月/今日）
- `orders` — 订单统计（总数/本月/上月/今日）
- `profit` — 利润统计（总/本月/上月/今日，仅代理商）
- `overview` — 综合概览（余额+充值+消费+订单+利润）

**示例解析**:

```
输入: "查询本月充值"
→ { intent: "query_stats",
    slots: { type: "recharge", period: "month" } }

输入: "查询上月消费"
→ { intent: "query_stats",
    slots: { type: "consumption", period: "last_month" } }

输入: "查询用户 user01 的今日利润"
→ { intent: "query_stats",
    slots: { type: "profit", period: "today",
             target_user: "user01" } }
```

#### batch_create_users（已停用）

该意图已停用，不再允许通过 NL 批量创建用户。

#### query_dynamic_resource（动态资源 — v2.0 新增）

返回：总充值流量、实际剩余流量、累积消耗、本月消耗、今日消耗

#### query_static_resource（静态资源 — v2.0 新增，v3.8 修正）

**Capability**: `STATIC_RESOURCE_QUERY`  
**API**: `GET /api/settings/prices?is_global=false&proxy_types=101,102,103`

查询系统当前可用的静态代理库存，**按国家汇总**显示。

**交互示例**：

```
用户: 显示独享静态代理(isp)资源

系统:
🌐 独享静态代理(isp)资源总览
共 12 个国家/地区，156 个产品，8,320 条可用IP

1. 美国  3,450 条  (65 个产品)
2. 英国  1,200 条  (28 个产品)
3. 日本  890 条  (18 个产品)
4. 德国  650 条  (12 个产品)
...

您可以继续输入：
• "查看美国的静态代理" — 查看指定国家详情
• "显示业务共享静态代理(isp)资源" — 查看共享资源
• "查看动态资源" — 查看动态代理资源
• "查看我的订单" — 查看已购订单
```

**返回数据**：

| 字段 | 说明 |
|------|------|
| `countries[].name` | 国家名称 |
| `countries[].code` | 国家编码 |
| `countries[].stock` | 该国可用IP总数 |
| `countries[].products` | 该国产品数 |
| `totalStock` | 全球可用IP总数 |
| `totalProducts` | 全部产品数 |

> **v3.8 修正**: 此前该意图错误调用了 Dashboard API 并显示订单统计数据，
> 与"静态资源"的语义不符。现已修正为查询产品库存 API，
> 按国家汇总可用 IP 数量，并引导用户深入查看具体国家或切换到其他资源。

#### query_static_orders（静态订单查询 — v2.1 增强）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `target_user` | string | ❌ | 用户名，代理商查询时包含所有子用户 |
| `count` | number | ❌ | 返回记录数（默认 10，最大 100） |
| `search` | string | ❌ | IP 地址、订单号等关键词搜索（传递给后端 `search` + `is_search=true`） |

**示例解析**:

```
输入: "查询140.99.35.213的订单"
→ { intent: "query_static_orders",
    slots: { search: "140.99.35.213" } }

输入: "查询yeye001静态代理订单"
→ { intent: "query_static_orders",
    slots: { target_user: "yeye001" } }
  (若 yeye001 是代理商，自动传 agent_id 以包含所有子用户)
```

#### query_transactions（交易记录查询 — v2.1 增强）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `target_user` | string | ❌ | 用户名，代理商查询时包含所有子用户 |
| `count` | number | ❌ | 返回记录数（默认 10，最大 100） |
| `search` | string | ❌ | IP 地址、供应商名称等关键词搜索 |
| `date_range` | object | ❌ | `{ start_date, end_date }`，支持 "2026-03-01到2026-03-02" 和 "3月1日到3月2日" 格式 |

**示例解析**:

```
输入: "查询ye0001最近100条交易记录"
→ { intent: "query_transactions",
    slots: { target_user: "ye0001", count: 100 } }

输入: "查询ye0001 3月1日到3月2日交易记录"
→ { intent: "query_transactions",
    slots: { target_user: "ye0001",
             date_range: { start_date: "2026-03-01",
                           end_date: "2026-03-02" } } }
```

#### reset_password（重置密码 — v2.0 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `target_user` | string | ❌ | 留空表示重置自己的密码 |
| `new_password` | string | ❌ | 留空则随机生成 |

#### purchase_dynamic（开通动态代理 — v2.0 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `traffic_gb` | number | ✅ | 流量（GB） |
| `country` | string | ❌ | 国家代码 |
| `target_user` | string | ❌ | 目标用户（代理商可代开） |

#### purchase_static（开通静态代理 — v3.0 更新）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `ip_segment` | string | ❌ | 指定 IP 地址 |
| `quantity` | number | ❌ | IP 数量，默认 1 |
| `country` | string | ❌ | 国家代码 |
| `city` | string | ❌ | 城市代码 |
| `duration` | number | ❌ | 时长（天），默认 30 |
| `remark` | string | ❌ | 备注 |
| `target_user` | string | ❌ | 目标用户 |

**v3.0 变更**:
- 当只指定地区而无具体 IP 时，先列出该地区可用 IP 列表供用户选择
- 开通成功后显示代理凭证（IP:端口:用户名:密码）和开通/到期时间

#### renew_static（续费静态代理 — v3.0 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `ip_segment` | string | ❌ | 要续费的 IP |
| `order_no` | string | ❌ | 订单号 |
| `duration` | number | ❌ | 续费时长（天），默认 30 |
| `target_user` | string | ❌ | 目标用户 |

> ip_segment 和 order_no 至少提供一个。续费月数只能为 1/3/6/12 个月。

**示例解析**:

```
输入: "续费 149.119.141.100，3个月"
→ { intent: "renew_static",
    slots: { ip_segment: "149.119.141.100", duration: 90 } }

输入: "帮我续费"
→ { intent: "renew_static", slots: {} }
→ 提示用户指定 IP 或订单号
```

#### query_today_orders（今日消费查询 — v3.0 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `target_user` | string | ❌ | 目标用户 |

查询今天开通的所有静态和动态代理订单，按类型分组显示。

#### check_ip_quality（检测 IP 质量 — v3.0 更新）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `ip_segment` | string | ✅ | 要检测的 IP 地址 |

**v3.0 变更**: 改用 IPQualityScore API，结果缓存 72 小时。

**示例解析**:

```
输入: "查询 2.3.4.5 的质量"
→ { intent: "check_ip_quality",
    slots: { ip_segment: "2.3.4.5" } }
```

#### find_best_ip（查找最优质 IP — v3.0 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `country` | string | ❌ | 国家代码 |
| `city` | string | ❌ | 城市代码 |
| `max_check` | number | ❌ | 最多检测几个 IP，默认 5 |

**示例解析**:

```
输入: "开通一个美国质量最好的IP"
→ { intent: "find_best_ip",
    slots: { country: "USA" } }
```

#### purchase_ip（购买 IP）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `ip_segment` | string | ✅ | IP 号段 |
| `quantity` | number | ✅ | 数量 |
| `duration_days` | number | ❌ | 时长（天） |

**示例解析**:

```
输入: "我需要 192.168.1.0 这个 IP 号段 10 条"
→ { intent: "purchase_ip",
    slots: { ip_segment: "192.168.1.0",
             quantity: 10 } }
```

#### create_profile（创建浏览器配置 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `name` | string | ❌ | 配置名称，留空自动生成 |
| `os` | string | ❌ | 操作系统: windows/macos/linux/android/ios |
| `browser` | string | ❌ | 浏览器: chrome/firefox/edge/safari |
| `country` | string | ❌ | 国家代码/名称，用于指纹地理匹配 |
| `city` | string | ❌ | 城市代码/名称 |
| `group` | string | ❌ | 分组名称 |
| `bind_proxy` | boolean | ❌ | 是否自动绑定匹配代理 |

**示例解析**:

```
输入: "创建一个美国 Chrome 浏览器配置"
→ { intent: "create_profile",
    slots: { os: "windows", browser: "chrome",
             country: "US" } }

输入: "创建 5 个日本 Firefox 配置，自动绑定代理"
→ { intent: "batch_create_profiles",
    slots: { count: 5, os: "windows",
             browser: "firefox", country: "JP",
             bind_proxy: true } }
```

#### list_profiles（查看浏览器配置 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `status` | string | ❌ | active/archived/all |
| `group` | string | ❌ | 分组名称 |
| `count` | number | ❌ | 返回数量，默认 10 |

#### update_profile（修改浏览器配置 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `field` | string | ❌ | 要修改的字段名 |
| `value` | unknown | ❌ | 新值 |

#### bind_proxy（绑定代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `session_id` | string | ❌ | Session ID，留空自动匹配 |
| `country` | string | ❌ | 自动匹配时的目标国家 |

**示例解析**:

```
输入: "给配置 prof_xxx 绑定美国代理"
→ { intent: "bind_proxy",
    slots: { profile_id: "prof_xxx",
             country: "US" } }
```

#### generate_fingerprint（生成指纹 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `os` | string | ❌ | 操作系统 |
| `browser` | string | ❌ | 浏览器 |
| `country` | string | ❌ | 目标国家（影响时区/语言） |

#### launch_browser（启动浏览器 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `headless` | boolean | ❌ | 是否无头模式，默认 true |
| `start_url` | string | ❌ | 初始 URL |

**示例解析**:

```
输入: "启动配置 prof_xxx 的浏览器，访问 google.com"
→ { intent: "launch_browser",
    slots: { profile_id: "prof_xxx",
             start_url: "https://google.com" } }
```

#### submit_task（提交浏览器任务 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `task_type` | string | ❌ | navigate/scrape/screenshot/custom |
| `target_url` | string | ✅ | 目标 URL |
| `actions` | string | ❌ | 自然语言描述的操作步骤 |

**示例解析**:

```
输入: "用配置 prof_xxx 抓取 example.com 的数据"
→ { intent: "submit_task",
    slots: { profile_id: "prof_xxx",
             task_type: "scrape",
             target_url: "https://example.com" } }

输入: "截图 example.com，用美国配置"
→ { intent: "submit_task",
    slots: { task_type: "screenshot",
             target_url: "https://example.com",
             country: "US" } }
```

#### run_detection_test（反检测测试 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `test_sites` | string[] | ❌ | pixelscan/browserleaks/creepjs |

**示例解析**:

```
输入: "检测配置 prof_xxx 的指纹质量"
→ { intent: "run_detection_test",
    slots: { profile_id: "prof_xxx" } }
```

#### set_user_agent（设置 UA — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `browser` | string | ❌ | 浏览器: chrome/firefox/edge/safari |
| `version` | string | ❌ | 版本号，如 "120" |
| `os` | string | ❌ | 操作系统: windows/macos/linux |
| `custom_ua` | string | ❌ | 自定义完整 UA 字符串 |

**示例解析**:

```
输入: "设置配置 prof_xxx 的 UA 为 Chrome 120"
→ { intent: "set_user_agent",
    slots: { profile_id: "prof_xxx",
             browser: "chrome", version: "120" } }
```

#### set_timezone（设置时区 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `timezone` | string | ✅ | 时区名称或缩写: "EST"/"America/New_York" |

**示例解析**:

```
输入: "把配置 prof_xxx 的时区改成美东时间"
→ { intent: "set_timezone",
    slots: { profile_id: "prof_xxx",
             timezone: "America/New_York" } }
```

#### set_language（设置语言 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `locale` | string | ✅ | 语言代码: "en-US"/"zh-CN"/"ja-JP" |
| `languages` | string[] | ❌ | 语言优先级列表 |

#### set_canvas（设置 Canvas — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `mode` | string | ✅ | noise / block / real |

#### set_webgl（设置 WebGL — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `mode` | string | ✅ | noise / block / real |
| `vendor` | string | ❌ | GPU 厂商 |
| `renderer` | string | ❌ | GPU 渲染器 |

#### set_audio（设置 Audio — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `mode` | string | ✅ | noise / block / real |

#### set_webrtc（设置 WebRTC — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `mode` | string | ✅ | real / disabled / fake |
| `public_ip` | string | ❌ | fake 模式的伪装公网 IP |

**示例解析**:

```
输入: "禁用配置 prof_xxx 的 WebRTC"
→ { intent: "set_webrtc",
    slots: { profile_id: "prof_xxx",
             mode: "disabled" } }
```

#### set_fonts（设置字体 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `fonts` | string[] | ✅ | 字体列表 |

#### set_plugins（设置插件 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `plugins` | string[] | ✅ | 插件名称列表 |

#### set_client_hints（设置 Client Hints — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `platform` | string | ❌ | 平台: Windows/macOS/Linux |
| `mobile` | boolean | ❌ | 是否移动端 |
| `architecture` | string | ❌ | 架构: x86/arm |

#### import_profile（导入配置 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `format` | string | ❌ | 格式: json（默认） |
| `file_path` | string | ❌ | 文件路径 |
| `auto_generate` | boolean | ❌ | 自动生成缺失的指纹参数 |

#### export_profile（导出配置 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ❌ | 配置 ID（不填导出全部） |
| `group` | string | ❌ | 按分组导出 |
| `include_cookies` | boolean | ❌ | 含 Cookie（可兼作备份） |

#### group_profile（分组管理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `group_name` | string | ✅ | 分组名称 |
| `action` | string | ❌ | add / remove / create（默认 add） |

#### tag_profile（标签管理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `tags` | string[] | ✅ | 标签列表 |
| `action` | string | ❌ | add / remove（默认 add） |

#### add_proxy（添加代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `proxy_url` | string | ✅ | 代理 URL: socks5://user:pass@host:port |
| `name` | string | ❌ | 代理名称 |
| `country` | string | ❌ | 国家 |
| `tags` | string[] | ❌ | 标签 |

**示例解析**:

```
输入: "添加代理 socks5://user:pass@1.2.3.4:1080，美国"
→ { intent: "add_proxy",
    slots: { proxy_url: "socks5://user:pass@1.2.3.4:1080",
             country: "US" } }
```

#### import_proxy（导入代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `format` | string | ❌ | text / json（默认 text） |
| `auto_verify` | boolean | ❌ | 导入后自动验证（默认 true） |

#### verify_proxy（验证代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `proxy_id` | string | ❌ | 代理 ID |
| `proxy_url` | string | ❌ | 或直接提供代理 URL |

#### rotate_proxy（轮换代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `country` | string | ❌ | 新代理的目标国家 |

#### list_proxy（代理列表 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `country` | string | ❌ | 按国家筛选 |
| `status` | string | ❌ | active/failed/untested/all |
| `count` | number | ❌ | 返回数量，默认 10 |

#### validate_fingerprint（校验一致性 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |

**示例解析**:

```
输入: "检查配置 prof_xxx 的指纹一致性"
→ { intent: "validate_fingerprint",
    slots: { profile_id: "prof_xxx" } }
```

#### auto_match_proxy（自动匹配代理 — Phase 2 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `prefer_type` | string | ❌ | 偏好类型: residential/datacenter |

#### restart_browser（重启浏览器 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `instance_id` | string | ✅ | 实例 ID |

#### batch_launch_browser（批量启动 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `group` | string | ❌ | 按分组启动 |
| `profile_ids` | string[] | ❌ | 配置 ID 列表 |
| `headless` | boolean | ❌ | 是否无头模式 |
| `start_url` | string | ❌ | 初始 URL |

#### batch_close_browser（批量关闭 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `instance_ids` | string[] | ❌ | 实例 ID 列表（空则全部） |
| `save_cookies` | boolean | ❌ | 是否保存 Cookie |

#### run_script（运行脚本 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `instance_id` | string | ✅ | 实例 ID |
| `script` | string | ✅ | JS 脚本或自然语言描述 |
| `timeout_ms` | number | ❌ | 超时时间 |

**示例解析**:

```
输入: "在浏览器 inst_xxx 中获取页面标题"
→ { intent: "run_script",
    slots: { instance_id: "inst_xxx",
             script: "return document.title" } }
```

#### schedule_task（定时任务 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ✅ | 配置 ID |
| `task_type` | string | ❌ | 任务类型 |
| `target_url` | string | ✅ | 目标 URL |
| `delay` | string | ✅ | 延迟描述: "1小时后"/"明天10点" |

#### batch_task（批量任务 — Phase 3 新增）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `profile_id` | string | ❌ | 配置 ID（不填则为每个 URL 自动选配置） |
| `task_type` | string | ❌ | 任务类型 |
| `target_urls` | string[] | ✅ | 目标 URL 列表 |

### 6.3 规则引擎模式定义

```typescript
interface IntentPattern {
  intent: string
  patterns: RegExp[]
  keywords: string[]
  slot_extractors: SlotExtractor[]
  risk_level: 'low' | 'medium' | 'high'
  confirmation_required: boolean
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'create_user',
    patterns: [
      /开通.*(用户|帐户|账户|账号)/,
      /创建.*(用户|帐户|账户|账号)/,
      /新建.*(用户|帐户|账户|账号)/,
    ],
    keywords: ['开通', '创建', '注册', '用户', '账号'],
    slot_extractors: [
      {
        slot: 'username',
        pattern: /(?:账号|用户名)[是为：:\s]*(\S+)/
      },
      {
        slot: 'password',
        pattern: /密码[是为：:\s]*(\S+)/
      }
    ],
    risk_level: 'high',
    confirmation_required: true
  },
  {
    intent: 'assign_balance',
    patterns: [
      /给.*(用户|账号).*(分配|充值|加).*(额度|余额|钱)/,
      /(分配|充值).*(额度|余额)/,
    ],
    keywords: ['分配', '额度', '充值', '余额'],
    slot_extractors: [
      {
        slot: 'target_user',
        pattern: /(?:用户|账号)[是为：:\s]*(\S+)/
      },
      {
        slot: 'amount',
        pattern: /(\d+(?:\.\d+)?)\s*元/
      }
    ],
    risk_level: 'high',
    confirmation_required: true
  },
  {
    intent: 'query_ip_inventory',
    patterns: [
      /(查询|查看|搜索).*(ip|IP|代理).*(库存|价格)/,
      /(\S+).*有.*(?:哪些|什么).*(ip|IP)/,
      /(\S+).*(ip|IP).*(库存|价格|多少)/,
    ],
    keywords: ['IP', 'ip', '库存', '价格', '号段'],
    slot_extractors: [
      { slot: 'city', pattern: 'CITY_NER' },
      { slot: 'country', pattern: 'COUNTRY_NER' }
    ],
    risk_level: 'low',
    confirmation_required: false
  },
  {
    intent: 'query_stats',
    patterns: [
      /查询.*(本月|今日|本周|今天).*(利润|消费|花费|收入)/,
      /(本月|今日|本周|今天).*(利润|消费|花费|收入)/,
    ],
    keywords: ['利润', '消费', '统计', '花费'],
    slot_extractors: [
      {
        slot: 'type',
        pattern: /(利润|消费|花费|收入|流量)/
      },
      {
        slot: 'period',
        pattern: /(今日|今天|本周|本月|上月)/
      }
    ],
    risk_level: 'low',
    confirmation_required: false
  },
  {
    intent: 'query_dashboard',
    patterns: [
      /查询.*仪表盘/,
      /仪表盘.*数据/,
      /dashboard/i,
    ],
    keywords: ['仪表盘', 'dashboard'],
    slot_extractors: [],
    risk_level: 'low',
    confirmation_required: false
  }
]
```

### 6.4 地理名称映射表

系统内置中英文城市/国家名称映射，用于 NER。

**多编码城市映射（v3.9 新增）**：不同供应商对同一城市使用不同编码，
系统通过 `CITY_NAME_TO_CODES` 反向映射自动展开：

| 城市 | 编码 | 供应商 |
|------|------|--------|
| 伦敦 | `GBR000LON` | mb/ipideash/ipv |
| 伦敦 | `GBR000000` | mb (旧) |
| 伦敦 | `GBRENGLND` | LM |
| 东京 | `JPN000TYO` | mb |
| 东京 | `JPN000000` | mb (旧) |
| 东京 | `JPN000013`/`JPN000001` | LM |
| 首尔 | `KOR000SEL` | mb |
| 首尔 | `KOR000000`/`KOR011SEO` | LM |

```typescript
// resolveGeo("伦敦") 自动展开为 3 个候选：
{
  city: 'GBR000LON',
  candidates: [
    { cityCode: 'GBR000000' },
    { cityCode: 'GBR000LON' },
    { cityCode: 'GBRENGLND' },
  ]
}
// matchProductCandidate 逐个匹配，不再遗漏
```

**产品匹配三字段检查（v2.8 修复）**：

不同供应商在 API 返回中将城市编码存储在不同字段
（`city`、`area`、`state`），`matchProductCandidate`
现在统一检查这三个字段：

```typescript
// 检查 city + area + state 三字段
const locationCodes = [pCity, pArea, pState];
for (const loc of locationCodes) {
  if (loc === candidateCode) return true;
  if (loc.startsWith(candidateCode)) return true;
}
```

同时对匹配结果做 `deduplicateProducts` 去重（按 `product_no`），
防止跨供应商同城产品重复显示。

返回的 `data` 包含 `geoDebug` 字段用于开发调试：
```json
{
  "input": "伦敦",
  "cityCandidates": ["GBR000000", "GBR000LON", "GBRENGLND"],
  "matchedNames": ["伦敦", "London"],
  "matchedCount": 12
}
```

> **实现**: `geo-mapping.ts` 的 `CITY_NAME_TO_CODES` (反向映射) + `expandCityCandidates()`

---

## 7. 指令执行引擎

### 7.1 执行流程

```typescript
interface ExecutionPlan {
  intent: string
  slots: Record<string, unknown>
  steps: ExecutionStep[]
  confirmation_required: boolean
  confirmation_message?: string
}

interface ExecutionStep {
  order: number
  api: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params: Record<string, unknown>
  result_key: string
  depends_on?: string
}
```

### 7.2 各意图执行方案

#### create_user — 创建用户

```
1. 生成随机用户名（如未指定）:
   格式: nx_{8位随机字母数字}
   示例: nx_a1b2c3d4

2. 生成随机密码（如未指定）:
   格式: 12 位，含大小写字母+数字+特殊字符
   示例: Kx9#mP2$nQ7!

3. 调用 Backend API:
   POST /api/open/app/user/create/v2
   Body: {
     "username": "<生成的用户名>",
     "password": "<生成的密码>",
     "agent_id": <当前代理商ID>
   }

4. 返回结果:
   "用户创建成功！
   账号: nx_a1b2c3d4
   密码: Kx9#mP2$nQ7!
   请妥善保管以上信息。"
```

#### assign_balance — 分配额度

```
1. 验证目标用户存在:
   GET /api/open/app/user/list (搜索用户名)

2. 确认操作（需用户点击确认按钮）:
   "确认给用户 user01 分配 100 元额度？"

3. 执行分配:
   POST /api/open/app/user/{user_id}/balance
   Body: { "amount": 100 }

4. 返回结果:
   "已成功给用户 user01 分配 100 元额度。
   当前余额: ¥200.00"
```

#### query_ip_inventory / query_static_products — 查询 IP 库存 / 静态产品

```
1. 调用价格 API（按角色构建参数，与前端 StaticBusiness.tsx 一致）:

   - 管理员:
     GET /api/settings/prices
       ?is_global=true&proxy_types=101&proxy_types=102&proxy_types=103
     后端返回: price=全局售价, costPrice=成本价, globalPrice=全局售价

   - 代理商（默认，查看自己）:
     GET /api/settings/prices
       ?is_global=false&proxy_types=101&proxy_types=102&proxy_types=103
     后端自动设置 agent_id=当前用户ID
     返回: price=代理商价, costPrice=成本价

   - 代理商（指定用户 target_user）:
     GET /api/settings/prices
       ?is_global=false&agent_id={agentId}&user_id={targetUserId}
       &proxy_types=101&proxy_types=102&proxy_types=103
     返回: price=该用户价格, costPrice=代理商价格

   - 普通用户:
     GET /api/settings/prices
       ?is_global=false&proxy_types=101&proxy_types=102&proxy_types=103
     后端自动设置 user_id=当前用户ID
     返回: price=用户价格

   认证: 用户自身 Token

2. 代理商指定用户查询:
   - 从 slots.target_user 提取目标用户名
   - 通过 findUserAcrossRoles 解析为 userId
   - 权限校验: found.agent_id === user.userId（必须是名下用户）
   - 校验失败返回明确错误

3. 客户端筛选（与前端一致的方式）:
   - geo-mapping.ts 将自然语言地名转为数据库编码
     (如 "纽约" → "USA0NY", "华盛顿" → "USA0DC")
   - 使用前缀匹配(startsWith)在返回的产品数据中筛选:
     product.city.startsWith(cityCode) 或
     product.country.startsWith(countryCode)
   - 过滤条件: active !== 0, enable !== 0, stock > 0

4. 价格展示（按角色区分，对齐前端 StaticBusiness.tsx）:
   - 管理员: 成本：¥{costPrice}；全局售价：¥{globalPrice}
   - 代理商（默认）: 代理商价：¥{price}；成本：¥{costPrice}
     （对应前端"用户单价"列 + "成本价"列）
   - 代理商（指定用户 xxx）: 用户 xxx 价格：¥{price}
   - 普通用户: 我的价格：¥{price}

5. 支持排序:
   - "最便宜的IP" → sort=price_asc，按价格升序
   - "最贵的IP" → sort=price_desc，按价格降序

6. 格式化结果示例（按角色）:

   管理员:
   "📦 纽约 静态代理产品 (15 个IP段)：
   美国-纽约 [纯净静态1]
   1. 146.71.35.0 库存：47；成本：¥7.5；全局售价：¥15.5
   2. 146.71.36.0 库存：12；成本：¥7.5；全局售价：¥15.5"

   代理商（默认）:
   "📦 纽约 静态代理产品 (15 个IP段)：
   美国-纽约 [纯净静态1]
   1. 146.71.35.0 库存：47；代理商价：¥9.5；成本：¥7.5
   2. 146.71.36.0 库存：12；代理商价：¥9.5；成本：¥7.5"

   代理商指定用户 wenjianhao:
   "📦 纽约 静态代理产品 (15 个IP段)：
   美国-纽约 [纯净静态1]
   1. 146.71.35.0 库存：47；用户 wenjianhao 价格：¥12.5
   2. 146.71.36.0 库存：12；用户 wenjianhao 价格：¥12.5"

   普通用户:
   "📦 纽约 静态代理产品 (15 个IP段)：
   美国-纽约 [纯净静态1]
   1. 146.71.35.0 库存：47；我的价格：¥12.5
   2. 146.71.36.0 库存：12；我的价格：¥12.5"
```

#### query_stats — 查询统计

```
1. 获取仪表盘数据:
   GET /api/open/app/dashboard/info/v2
     ?target_user_id=<user_id>

2. 根据 type 提取对应数据:
   - profit → statistics.monthly_profit
   - cost   → statistics.monthly_orders 金额
   - traffic → dynamicResources 流量汇总

3. 格式化结果:
   "📊 本月统计:
   • 总利润: ¥1,250.00
   • 总消费: ¥3,800.00
   • 总订单: 45 笔
   • 总流量: 128.5 GB"
```

#### check_ip_quality — 检测 IP 质量（v3.0 更新）

```
1. 从 slots 获取 ip_segment

2. 调用后端 GET /api/ip-quality/check?ip=X.X.X.X
   - 后端先查 ip_quality_cache 表（72h 缓存）
   - 缓存未命中则调用 IPQualityScore API
   - 结果存入数据库

3. 格式化质量报告:
   "🔍 IP 质量报告: 2.3.4.5

   • 欺诈评分: 15/100
   • 风险等级: 🟢 低风险
   • 代理: ✓ 否
   • VPN: ✓ 否
   • TOR: ✓ 否
   • Bot: ✓ 否
   • 近期滥用: ✓ 否
   • ISP: Amazon.com
   • ASN: 14618
   • 组织: Amazon Technologies
   • 位置: US / Virginia / Ashburn
   • 查询时间: 2026-03-02T15:30:00"
```

#### find_best_ip — 查找最优质 IP（v3.0 新增）

```
1. 提示用户: 该功能需要多次查询第三方 API，可能产生费用

2. 调用 executeQueryStaticProducts 获取地区 IP 列表

3. 取前 5 个 IP 段的代表 IP（.1）

4. 逐一调用 /api/ip-quality/check 检测

5. 按 fraud_score 升序排列

6. 展示最优 IP 详细报告 + 排名列表 + 快捷开通建议
```

#### purchase_static / purchase_ip — 开通静态代理 IP

```
1. 角色与权限:
   - 管理员: 不允许直接开通，提示以用户身份操作
   - 代理商: 必须指定 target_user（名下用户），例如:
     "帮用户 wenjianhao 开通 167.148.72.0，30天"
     权限校验: found.agent_id === agent.userId（必须是名下用户）
   - 普通用户: 直接为自己开通

2. 目标用户解析（优先于价格查询）:
   - 从 slots.target_user 或 user.username 获取目标用户名
   - 通过 findUserAcrossRoles 解析为 userId
   - 代理商场景: 校验目标用户属于当前代理商名下
   - 校验失败返回明确错误

3. 价格查询（角色感知，与前端 StaticBusiness.tsx 一致）:
   - 代理商: GET /api/settings/prices
       ?is_global=false&agent_id={agentId}&user_id={targetUserId}
       &proxy_types=101&proxy_types=102&proxy_types=103
     返回该用户的真实价格
   - 普通用户: GET /api/settings/prices
       ?is_global=false&proxy_types=101&proxy_types=102&proxy_types=103
     后端自动匹配用户价格

4. 订单创建:
   POST /api/open/app/static/order/create/v2
   Body: {
     orderType: 'static_proxy',
     poolId: productNo,
     unitPrice: <角色对应的真实价格>,
     totalAmount: unitPrice * qty * cycleTimes,
     userId: <目标用户ID>,
     target_username: <目标用户名>,
     ipCount: qty,
     duration: 30,
     unit: 1,
     cycleTimes: Math.round(durationDays / 30),
     countryCode, cityCode, staticType,
     remark: 'NL Agent: {operator} → {target}',
     app_order_no: 'NL{timestamp}{random}',
     ipRange?: ...,
     cidrBlocks?: [...],
     assignedIp?: ...
   }

5. 审计信息:
   - remark 自动记录: 操作者 → 目标用户
   - target_username 字段标识订单归属
   - app_order_no 以 NL 前缀标识来源

6. 返回结果:
   "✅ 静态代理开通成功！
   • IP段: 167.148.72.0/24 (随机分配)
   • 数量: 1
   • 时长: 30 天
   • 用户: wenjianhao
   • 代理信息: 167.148.72.5:6013:user:pass
   • 开通时间: 2026年3月19日 15:30
   • 到期时间: 2026年4月18日 15:30"
```

### 7.3 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| 意图无法识别 | 返回提示："我暂时无法理解这个指令，你可以试试：..." |
| 缺少必要参数 | 追问用户补充信息 |
| 用户不存在 | 友好提示 + 建议创建 |
| 余额不足 | 显示当前余额 + 建议充值 |
| API 调用失败 | 显示错误原因 + 建议重试 |
| 权限不足 | 提示联系管理员 |

### 7.4 上下文管理

对话具有短期上下文记忆，支持多轮对话：

```typescript
interface ConversationContext {
  session_id: string
  user_id: number
  messages: Message[]
  slots_memory: Record<string, unknown>
  last_intent?: string
  last_result?: unknown
  created_at: Date
  expires_at: Date // 30 分钟过期
}
```

**多轮对话示例**:

```
用户: "查询华盛顿有哪些 IP"
系统: [展示 IP 列表]

用户: "通过 ping0 查询这些号段的数据"
      ↑ "这些号段" 从上下文获取

用户: "我要 192.168.1.0 这个号段 10 条"
      ↑ 明确指定的号段

系统: "确认购买 192.168.1.0 号段 10 条？"
用户: "确认"
系统: [执行购买]
```

---

## 8. API 映射表

### 8.1 NL Agent API → 后端 API 映射

| 意图 | 调用的后端 API | 认证方式 |
|------|---------------|---------|
| `create_user` | `POST /api/open/app/user/create/v2` | Admin Token |
| `batch_create_users` | `POST /api/open/app/user/create/v2` × N | Admin Token |
| `assign_balance` | `POST /api/open/app/user/adjust-balance` | Admin Token |
| `reset_password` | `POST /api/open/app/user/{id}/change-password` | Admin Token |
| `get_referral_code` | `GET /api/agent/referral` | User Token |
| `query_stats` | `GET /api/open/app/dashboard/info/v2` | User Token |
| `query_dashboard` | `GET /api/open/app/dashboard/info/v2` | User Token |
| `query_balance` | `GET /api/open/app/user/balance/current` | User Token |
| `query_dynamic_resource` | `GET /api/open/app/dynamic/resource/stats` | User Token |
| `query_static_resource` | `GET /api/settings/prices?is_global=false&proxy_types=101,102,103` → 按国家汇总库存 | User Token |
| `query_user_detail` | `GET /api/open/app/dashboard/info/v2?target_user_id=X` | User Token |
| `query_static_products` | `GET /api/settings/prices?is_global=false&proxy_types=101,102,103` + 客户端地域筛选 | User Token |
| `query_ip_inventory` | `GET /api/settings/prices?is_global=false&proxy_types=101,102,103` + 客户端地域筛选 | User Token |
| `query_dynamic_orders` | `GET /api/dynamic?user_id=X&agent_id=X` | User Token |
| `query_static_orders` | `GET /api/open/app/static/order/list/v2?search=X&is_search=true&user_id=X&agent_id=X` | User Token |
| `query_transactions` | `GET /api/open/app/user/transactions?target_user_id=X&agent_id=X&keyword=X` | User Token |
| `purchase_dynamic` | `POST /api/open/app/proxy/open/v2` | Admin Token |
| `purchase_static` | `POST /api/open/app/instance/open/v2` | Admin Token |
| `purchase_ip` | `POST /api/open/app/instance/open/v2` | Admin Token |
| `set_product_price` | `POST /api/settings/price` | Admin Token |
| `check_ip_quality` | 外部: ping0.cc API（即将对接） | — |
| `create_profile` | `POST /v1/profiles` | API Key |
| `list_profiles` | `GET /v1/profiles` | API Key |
| `update_profile` | `PUT /v1/profiles/:id` | API Key |
| `delete_profile` | `DELETE /v1/profiles/:id` | API Key |
| `duplicate_profile` | `POST /v1/profiles/:id/duplicate` | API Key |
| `bind_proxy` | `POST /v1/profiles/:id/bind-proxy` | API Key |
| `generate_fingerprint` | `POST /v1/fingerprints/generate` | API Key |
| `batch_create_profiles` | `POST /v1/profiles/batch-create` | API Key |
| `launch_browser` | `POST /v1/browser/launch` | API Key |
| `close_browser` | `POST /v1/browser/instances/:id/close` | API Key |
| `list_browsers` | `GET /v1/browser/instances` | API Key |
| `navigate_to` | `POST /v1/browser/instances/:id/navigate` | API Key |
| `take_screenshot` | `POST /v1/browser/instances/:id/screenshot` | API Key |
| `submit_task` | `POST /v1/tasks` | API Key |
| `query_task` | `GET /v1/tasks/:id` | API Key |
| `run_detection_test` | `POST /v1/anti-detect/test` | API Key |
| `set_user_agent` | `PUT /v1/profiles/:id` (fingerprint.user_agent) | API Key |
| `set_timezone` | `PUT /v1/profiles/:id` (fingerprint.location.timezone) | API Key |
| `set_language` | `PUT /v1/profiles/:id` (fingerprint.location.locale) | API Key |
| `set_canvas` | `PUT /v1/profiles/:id` (fingerprint.canvas) | API Key |
| `set_webgl` | `PUT /v1/profiles/:id` (fingerprint.webgl) | API Key |
| `set_audio` | `PUT /v1/profiles/:id` (fingerprint.audio) | API Key |
| `set_webrtc` | `PUT /v1/profiles/:id` (fingerprint.webrtc) | API Key |
| `set_fonts` | `PUT /v1/profiles/:id` (fingerprint.fonts) | API Key |
| `set_plugins` | `PUT /v1/profiles/:id` (fingerprint.plugins) | API Key |
| `set_client_hints` | `PUT /v1/profiles/:id` (fingerprint.client_hints) | API Key |
| `import_profile` | `POST /v1/profiles/import` | API Key |
| `export_profile` | `GET /v1/profiles/export` | API Key |
| `group_profile` | `POST /v1/profile-groups/:id/profiles` | API Key |
| `tag_profile` | `PUT /v1/profiles/:id` (tags) | API Key |
| `add_proxy` | `POST /v1/proxies` | API Key |
| `import_proxy` | `POST /v1/proxies/import` | API Key |
| `verify_proxy` | `POST /v1/proxies/:id/verify` | API Key |
| `rotate_proxy` | `POST /v1/proxies/:id/rotate` | API Key |
| `list_proxy` | `GET /v1/proxies` | API Key |
| `validate_fingerprint` | `POST /v1/fingerprints/validate` | API Key |
| `auto_match_proxy` | `POST /v1/profiles/:id/auto-match-proxy` | API Key |
| `restart_browser` | `POST /v1/browser/instances/:id/restart` | API Key |
| `batch_launch_browser` | `POST /v1/browser/batch-launch` | API Key |
| `batch_close_browser` | `POST /v1/browser/batch-close` | API Key |
| `run_script` | `POST /v1/browser/instances/:id/run-script` | API Key |
| `schedule_task` | `POST /v1/tasks/schedule` | API Key |
| `batch_task` | `POST /v1/tasks/batch` | API Key |

> **注意**：  
> - 产品/价格查询使用 `/api/settings/prices`（与 ztproxy 前端一致），地域筛选（城市/国家）在客户端完成。  
> - `geo-mapping.ts` 中的城市编码使用数据库实际格式（如 `USA0NY`、`USA0DC`），前缀匹配产品的 `city`/`country` 字段。  
> - 订单查询支持 `search` 参数（IP 地址、订单号等），需同时传 `is_search=true`。  
> - 查询代理商名下数据时使用 `agent_id` 参数，会自动包含该代理商及其所有子用户的数据。  
> - 交易记录、订单查询支持 `count`（记录数）、`date_range`（日期范围）、`search`（IP/关键词）等扩展参数。

### 8.2 NL Agent API 接口设计

#### POST /nl/execute — 执行自然语言指令

**请求**:
```json
{
  "message": "查询华盛顿有哪些IP",
  "conversation_id": "conv_xxxx",
  "context": {}
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "conversation_id": "conv_xxxx",
    "intent": "query_ip_inventory",
    "message": "华盛顿地区可用IP信息：...",
    "data": {
      "dynamic_products": [...],
      "static_products": [...]
    },
    "suggestions": [
      "通过 ping0 检测这些号段",
      "购买其中的 IP"
    ],
    "requires_confirmation": false
  }
}
```

#### POST /nl/confirm — 确认执行

**请求**:
```json
{
  "conversation_id": "conv_xxxx",
  "confirmed": true
}
```

#### GET /nl/suggestions — 获取建议指令

**v3.0 变更**: 建议指令根据登录用户角色动态生成，不再是固定列表。

| 角色 | Account 建议 | 其他 |
|------|-------------|------|
| 管理员 | Create a new agent account | 显示利润查询 |
| 代理商 | Create user / Batch create / Get referral code | 显示利润查询 |
| 普通用户 | （不显示 Account 分类） | 不显示利润查询 |

**通用建议**: 所有角色均显示 Statistics、Resources、Orders & Purchase 分类。

"Buy 10GB US dynamic proxy" 已改为 "Buy 10GB dynamic proxy"（去掉 US）。

---

## 9. 对话交互设计

### 9.1 消息类型

```typescript
type MessageType =
  | 'user'            // 用户消息
  | 'system'          // 系统消息（执行结果）
  | 'confirmation'    // 确认请求
  | 'error'           // 错误消息
  | 'suggestion'      // 建议/提示
  | 'loading'         // 执行中状态

interface Message {
  id: string
  type: MessageType
  content: string
  data?: unknown        // 结构化数据（表格等）
  timestamp: Date
  actions?: Action[]    // 可操作按钮
}

interface Action {
  label: string
  type: 'confirm' | 'cancel' | 'link' | 'copy'
  payload?: unknown
}
```

### 9.2 交互流程示例

#### 示例 1：查看推荐返佣说明（无需确认）

```
[代理商] 获取我的推荐码

[系统 - loading] 正在查询...

[系统]
  推荐给其他用户对方每次充值你将获得15％的佣金！
  请发送邮件至support@ztproxy.net。
```

#### 示例 2：查询 IP（无需确认）

```
[用户] 华盛顿现在有哪些IP，分别什么价格和库存

[系统 - loading] 正在查询...

[系统]
  📦 华盛顿地区可用 IP：

  动态代理:
  ┌──────────────┬──────┬──────┐
  │ 产品          │ 价格  │ 库存 │
  ├──────────────┼──────┼──────┤
  │ 动态IP池1     │ ¥10/GB│ 充足 │
  │ 动态IP池3     │ ¥8/GB │ 充足 │
  └──────────────┴──────┴──────┘

  静态代理:
  ┌──────────────┬────────┬──────┐
  │ 产品          │ 价格   │ 库存 │
  ├──────────────┼────────┼──────┤
  │ WA 静态住宅IP │ ¥50/月 │ 89条 │
  └──────────────┴────────┴──────┘

  💡 试试: "通过 ping0 检测这些号段"
           "购买 10 条静态 IP"
```

#### 示例 3：多轮对话

```
[用户] 查询本月利润

[系统]
  📊 本月统计（2026年3月）:
  • 总利润: ¥1,250.00
  • 总订单: 45 笔
  • 活跃用户: 12 人

[用户] 帮我查询本月消费

[系统]
  💰 本月消费详情:
  • 动态代理消费: ¥2,500.00
  • 静态代理消费: ¥1,300.00
  • 总消费: ¥3,800.00

[用户] 帮我查询仪表盘数据

[系统]
  📊 仪表盘概览:
  • 余额: ¥5,200.00
  • 活跃会话: 8 个
  • 本月流量: 128.5 GB
  • 今日订单: 3 笔
```

### 9.3 建议指令提示

对话框初始状态和空闲时显示建议：

```
┌─────────────────────────────────┐
│  💡 你可以试试这些指令:           │
│                                  │
│  📋 用户管理                     │
│  ┊  "给用户 xxx 分配 100 元"     │
│  ┊  "推荐给其他用户对方每次充值你将获得15％的佣金，请发送邮件至support@ztproxy.net。" │
│                                  │
│  🔍 IP 查询                     │
│  ┊  "查询华盛顿有哪些 IP"        │
│  ┊  "查询洛杉矶静态 IP 库存"    │
│                                  │
│  📊 数据统计                     │
│  ┊  "查询本月利润"               │
│  ┊  "查询本月消费"               │
│  ┊  "查看仪表盘数据"             │
│                                  │
│  🛒 购买服务                     │
│  ┊  "显示静态独享(isp)订单"       │
│  ┊  "我需要 xxx 号段 10 条 IP"   │
│                                  │
│  点击上方示例可快速填入           │
└─────────────────────────────────┘
```

---

## 10. 安全与权限

### 10.1 权限模型

不同角色的用户可执行的指令不同。权限与前端登录用户保持一致。

#### 账户管理

| 意图 | 普通用户 | 代理商 | 管理员 | 备注 |
|------|:-------:|:-----:|:-----:|------|
| 分配额度 | ❌ | ✅ | ✅ | 管理员和代理商可分配 |
| 重置密码 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | 按层级隔离 |
| 推荐返佣说明 | ❌ | ✅ | ✅ | 推荐给其他用户对方每次充值你将获得15％的佣金；请发送邮件至support@ztproxy.net。 |

#### 查询操作

| 意图 | 普通用户 | 代理商 | 管理员 | 备注 |
|------|:-------:|:-----:|:-----:|------|
| 查询余额 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 查询统计(充值/消费/利润/订单) | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 仪表盘概览 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 动态代理资源 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 独享静态代理(isp)资源 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 业务共享静态代理(isp)资源 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 查询用户详情 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 查询静态产品 | 仅激活产品 | 仅激活产品 | 任何产品 | 参考 StaticBusiness.tsx |
| 查询 IP 库存 | 仅激活产品 | 仅激活产品 | 任何产品 | 参考 StaticBusiness.tsx |
| 查询产品 | 仅激活产品 | 仅激活产品 | 任何产品 | |
| 动态订单查询 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 静态订单查询 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |
| 交易记录 | 仅自己 | 自己+名下用户/二级代理 | 任何人 | |

#### 业务操作

| 意图 | 普通用户 | 代理商 | 管理员 | 备注 |
|------|:-------:|:-----:|:-----:|------|
| 开通动态代理 | ✅ 为自己 | ✅ 需指定用户 | ❌ | 管理员不能开通 |
| 开通静态代理 | ✅ 为自己 | ✅ 需指定用户 | ❌ | 管理员不能开通 |
| 购买 IP 号段 | ✅ 为自己 | ✅ 需指定用户 | ❌ | 管理员不能开通 |
| 创建代理会话 | ✅ 为自己 | ✅ 需指定用户 | ❌ | 管理员不能开通 |
| 提取动态代理 | ✅ | ✅ | ✅ | 已开通可提取 |
| 设置产品价格 | ❌ | ✅ 设置用户价格 | ✅ 设置全局/代理商价格 | 按角色隔离 |
| 检测 IP 质量 | ✅ | ✅ | ✅ | 所有人可用 |

### 10.2 安全策略

| 策略 | 说明 |
|------|------|
| **Token 认证** | 所有 NL API 调用需携带有效 JWT Token |
| **写操作确认** | 创建/修改/购买等操作必须用户二次确认 |
| **输入清理** | 过滤 XSS、SQL 注入等恶意输入 |
| **频率限制** | 对话每分钟最多 30 条消息 |
| **金额上限** | 单次分配/购买金额上限 ¥10,000 |
| **LLM 提示注入防护** | System Prompt 严格限定输出格式 |
| **日志审计** | 所有执行记录写入日志表 |
| **上下文隔离** | 不同用户的对话上下文完全隔离 |

### 10.3 LLM Prompt 注入防护

```
防护措施:
1. System Prompt 明确禁止超出预定义意图
2. Function Calling 约束输出格式为枚举值
3. 用户输入截断至 500 字符
4. 意图白名单验证：LLM 返回的意图必须
   在预定义列表中
5. 槽位类型检查：数值、用户名等做格式校验
6. 不向 LLM 传递敏感信息（密码、Token 等）
```

---

## 11. 技术选型

### 11.1 前端（对话框微应用）

| 组件 | 选型 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 与主前端技术栈一致 |
| 构建 | Vite | 快速构建，产物体积小 |
| 状态管理 | React Context + useReducer | 轻量，足够对话框使用 |
| HTTP | fetch API | 原生，无需额外依赖 |
| 样式 | CSS Modules | 避免与落地页样式冲突 |
| 打包输出 | 单文件 UMD | 嵌入静态 HTML 页面 |

### 11.2 NL Agent 后端

| 组件 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript (Node.js) | 与 Agent Layer 一致 |
| 框架 | Fastify | 与 Agent Layer 一致 |
| LLM 集成 | OpenAI API (gpt-4o-mini) | Function Calling 成熟 |
| 规则引擎 | 自研（正则 + 关键词） | 高频指令零成本解析 |
| 上下文存储 | 内存 (node-cache) | 短期上下文，30分钟过期 |
| 部署 | Railway | 与现有系统同平台 |

### 11.3 成本估算

| 项目 | 单价 | 月估算 |
|------|------|-------|
| LLM API (gpt-4o-mini) | ~$0.15/1M tokens | ~$5-10/月 |
| Railway 服务 | $5/月 起 | $5-10/月 |
| Cloudflare Pages | 免费 | $0 |

> 规则引擎可覆盖 70%+ 的指令，LLM 仅处理
> 规则无法匹配的长尾指令，成本可控。

---

## 12. 目录结构

### 12.1 前端微应用

```
nexalayer-landing/
├── index.html              ← 增加 #nl-app 挂载点
├── styles.css              ← 保持不变
├── main.js                 ← 保持不变
├── assets/                 ← 保持不变
├── app/                    ← 新增 React 微应用
│   ├── src/
│   │   ├── index.tsx           # 入口
│   │   ├── App.tsx             # 根组件
│   │   ├── components/
│   │   │   ├── ChatWidget.tsx      # 对话框主组件
│   │   │   ├── ChatMessage.tsx     # 消息气泡
│   │   │   ├── ChatInput.tsx       # 输入框
│   │   │   ├── ChatSuggestions.tsx  # 建议指令
│   │   │   ├── ConfirmDialog.tsx   # 确认对话框
│   │   │   ├── LoginModal.tsx      # 登录弹窗
│   │   │   ├── RegisterModal.tsx   # 注册弹窗
│   │   │   ├── AuthButtons.tsx     # 导航栏认证按钮
│   │   │   ├── DataTable.tsx       # 结果表格
│   │   │   └── LoadingDots.tsx     # 加载动画
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx      # 认证状态
│   │   │   └── ChatContext.tsx      # 对话状态
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useChat.ts
│   │   │   └── useNLAgent.ts
│   │   ├── api/
│   │   │   ├── auth.ts            # 登录/注册 API
│   │   │   └── nlAgent.ts         # NL Agent API
│   │   ├── types/
│   │   │   ├── auth.types.ts
│   │   │   ├── chat.types.ts
│   │   │   └── nl.types.ts
│   │   └── utils/
│   │       ├── token.ts           # Token 管理
│   │       └── format.ts          # 结果格式化
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── dist/
    └── nl-app.js           # 构建产物
```

### 12.2 NL Agent 后端

```
Agent/
├── src/
│   ├── modules/
│   │   └── nl-agent/                ← NL Agent 模块
│   │       ├── nl.routes.ts         # 路由
│   │       ├── nl.controller.ts     # 控制器
│   │       ├── nl.service.ts        # NL 主服务
│   │       ├── nl.schema.ts         # 请求验证
│   │       ├── capability-registry.ts # ★ Capability 注册表 (v3.8)
│   │       ├── intent-parser.ts     # 规则引擎 + 跟进检测 (v4.0)
│   │       ├── llm-parser.ts        # LLM 解析器
│   │       ├── geo-mapping.ts       # 地理名称映射
│   │       ├── executor.ts          # 执行引擎 + 跟进 executors (v4.0)
│   │       ├── executor-utils.ts    # 执行器工具函数
│   │       ├── help-resolver.ts     # 帮助系统
│   │       ├── conversation-context.ts # 上下文管理 + LastResult (v4.0)
│   │       ├── nl-auth.middleware.ts   # 认证中间件
│   │       ├── nl-history.service.ts   # 历史记录服务
│   │       └── suggestions.ts       # 建议指令
│   └── ...（现有模块不变）
├── docs/
│   ├── agentDesign.md
│   ├── agentManual.md
│   ├── agentTest.md
│   └── nexalayerNL.md       ← 本文档
└── ...
```

---

## 13. 实施路线图

### Phase 1 — 基础设施（已完成 ✅）

- [x] 落地页增加 React 微应用挂载点
- [x] 实现登录/注册弹窗组件
- [x] 对接 Backend 认证 API
- [x] 导航栏增加认证按钮
- [x] Token 管理和持久化
- [x] 构建和部署流程打通

### Phase 2 — 对话框 UI（已完成 ✅）

- [x] ChatWidget 主对话框组件
- [x] 消息列表（多种消息类型渲染）
- [x] 输入框组件（含发送按钮、快捷键）
- [x] 建议指令展示（可点击填入）
- [x] 确认对话框组件
- [x] 结果表格渲染组件
- [x] 加载状态动画
- [x] 响应式适配（移动端）

### Phase 3 — NL Agent 后端（已完成 ✅）

- [x] NL Agent 路由和控制器
- [x] 规则引擎实现（高频意图覆盖）
- [x] LLM 辅助解析集成（Function Calling）
- [x] 地理名称 NER 映射表
- [x] 上下文管理器实现

### Phase 4 — 指令执行器（已完成 ✅）

- [x] create_user / assign_balance / batch_create_users handler
- [x] query_ip_inventory / query_stats / query_dashboard handler
- [x] query_balance / query_transactions handler
- [x] purchase_dynamic / purchase_static / purchase_ip handler
- [x] renew_static / extract_dynamic handler
- [x] check_ip_quality / find_best_ip handler
- [x] 响应格式化器（表格、文本）
- [x] 帮助系统（Help Resolver）
- [x] 意图消歧机制

### Phase 5 — 安全与优化（已完成 ✅）

- [x] 权限校验中间件
- [x] 频率限制
- [x] 输入清理和 XSS 防护
- [x] LLM Prompt 注入防护
- [x] 操作日志审计
- [x] 性能优化（缓存、懒加载）
- [x] 错误处理和兜底策略

### Phase 6 — 指纹配置管理命令（Phase 2 新增）（已完成 ✅）

- [x] **Profile CRUD handler（8 个意图）**
  - `create_profile` → `POST /v1/profiles`
  - `list_profiles` → `GET /v1/profiles`
  - `update_profile` → `PUT /v1/profiles/:id`
  - `delete_profile` → `DELETE /v1/profiles/:id`
  - `duplicate_profile` → `POST /v1/profiles/:id/duplicate`
  - `bind_proxy` → `POST /v1/profiles/:id/bind-proxy`
  - `generate_fingerprint` → `POST /v1/fingerprints/generate`
  - `batch_create_profiles` → `POST /v1/profiles/batch-create`
- [x] **指纹参数控制 handler（10 个意图）**
  - `set_user_agent` / `set_timezone` / `set_language`
  - `set_canvas` / `set_webgl` / `set_audio`
  - `set_webrtc` / `set_fonts` / `set_plugins` / `set_client_hints`
  - 统一映射到 `PUT /v1/profiles/:id` 的指纹子字段
- [x] **Profile 管理扩展 handler（4 个意图）**
  - `import_profile` → `POST /v1/profiles/import`
  - `export_profile` → `GET /v1/profiles/export`
  - `group_profile` → `POST /v1/profile-groups/:id/profiles`
  - `tag_profile` → `PUT /v1/profiles/:id` (tags)
- [x] **代理管理 handler（5 个意图）**
  - `add_proxy` → `POST /v1/proxies`
  - `import_proxy` → `POST /v1/proxies/import`
  - `verify_proxy` → `POST /v1/proxies/:id/verify`
  - `rotate_proxy` → `POST /v1/proxies/:id/rotate`
  - `list_proxy` → `GET /v1/proxies`
- [x] **一致性校验 handler（2 个意图）**
  - `validate_fingerprint` → `POST /v1/fingerprints/validate`
  - `auto_match_proxy` → `POST /v1/profiles/:id/auto-match-proxy`
- [x] 规则引擎新增指纹配置类模式
  - 关键词：配置、指纹、Profile、浏览器、UA、时区、语言、Canvas、WebGL、WebRTC、代理
- [x] LLM 意图枚举扩展（新增 29 个意图 ID）
- [x] 建议指令更新（增加指纹配置相关建议）
- [x] 帮助系统更新（增加指纹配置类帮助）
  - 新增 `profile` / `fingerprint` / `proxy_mgmt` 三个命令分类
  - 新增 13 个指纹配置相关参数提示（PARAM_HINTS）
  - 新增 4 个指纹配置相关失败恢复提示（FAILURE_RECOVERY）
  - 关键词意图映射（KEYWORD_INTENT_MAP）增加 8 条指纹/代理相关规则

### Phase 7 — 浏览器操作命令（Phase 3 新增）（已完成 ✅）

- [x] **浏览器实例管理 handler（6 个意图）**
  - `launch_browser` → `POST /v1/browser/launch`
  - `close_browser` → `POST /v1/browser/instances/:id/close`
  - `restart_browser` → `POST /v1/browser/instances/:id/restart`
  - `batch_launch_browser` → `POST /v1/browser/batch-launch`
  - `batch_close_browser` → `POST /v1/browser/batch-close`
  - `list_browsers` → `GET /v1/browser/instances`
- [x] **自动化操作 handler（3 个意图）**
  - `navigate_to` → `POST /v1/browser/instances/:id/navigate`
  - `take_screenshot` → `POST /v1/browser/instances/:id/screenshot`
  - `run_script` → `POST /v1/browser/instances/:id/run-script`
- [x] **任务管理 handler（4 个意图）**
  - `submit_task` → `POST /v1/tasks`
  - `schedule_task` → `POST /v1/tasks/schedule`
  - `batch_task` → `POST /v1/tasks/batch`
  - `query_task` → `GET /v1/tasks/:id`
- [x] **反检测 handler（1 个意图）**
  - `run_detection_test` → `POST /v1/anti-detect/test`
- [x] 规则引擎新增浏览器操作类模式
  - 关键词：浏览器、启动、关闭、重启、批量、截图、任务、脚本、定时、检测
- [x] 任务状态轮询支持（类似 Session 异步创建模式）
- [x] 截图结果展示（返回截图 URL 或内联预览）
- [x] 反检测报告格式化输出
- [x] 帮助系统更新（增加浏览器/任务类帮助）
  - 新增 `browser` / `task` 两个命令分类
  - 新增 7 个浏览器/任务相关参数提示（PARAM_HINTS）
  - 新增 5 个浏览器/任务相关失败恢复提示（FAILURE_RECOVERY）
  - 关键词意图映射（KEYWORD_INTENT_MAP）增加 5 条浏览器/任务相关规则

### Phase 8 — Agent Browser OS（Phase 4 新增）

> 将 NL Agent 从「命令行工具」升级为「Agent Browser OS CLI」。
> 新增 ~50 个意图，覆盖 9 大模块。

- [x] **Profile 生命周期扩展（3 个意图）**
  - `pause_profile` — "暂停配置 PRF-xxx"
  - `resume_profile` — "恢复配置 PRF-xxx"
  - `archive_profile` — "归档配置 PRF-xxx"
- [x] **指纹维度扩展（11 个新意图，总计 21 个维度）**
  - `set_os` — "设置操作系统为 Windows"
  - `set_cpu` — "设置 CPU 为 8 核"
  - `set_memory` — "设置内存为 16GB"
  - `set_gpu` — "设置 GPU 为 RTX 3060"
  - `set_screen` — "设置分辨率为 1920x1080"
  - `set_media_devices` — "设置媒体设备"
  - `set_battery` — "关闭 Battery API"
  - `set_webgpu` — "设置 WebGPU 指纹"
  - `set_navigator` — "设置 navigator 属性"
  - `set_device_memory` — "设置 Device Memory"
  - `set_gamepad` — "关闭 Gamepad API"
- [x] **代理管理扩展（7 个新意图）**
  - `delete_proxy` — "删除代理 PRX-xxx"
  - `proxy_speed_test` — "测试代理速度"
  - `proxy_quality_check` — "检测代理质量"
  - `create_proxy_pool` — "创建代理池 美国住宅"
  - `list_proxy_pools` — "查看代理池"
  - `delete_proxy_pool` — "删除代理池"
  - `auto_select_proxy` — "自动选择最佳代理"
- [x] **浏览器页面操作（15 个新意图）**
  - `click_element` — "在浏览器 INS-xxx 点击 #login"
  - `input_text` — "在输入框 #search 输入 iphone"
  - `scroll_page` — "向下滚动页面"
  - `wait_for_element` — "等待元素 .result 出现"
  - `hover_element` — "悬停元素 #menu"
  - `select_option` — "选择下拉选项"
  - `extract_text` — "提取页面文本"
  - `extract_html` — "提取页面 HTML"
  - `extract_links` — "提取所有链接"
  - `extract_table` — "提取表格数据"
  - `export_cookies` — "导出 Cookie"
  - `import_cookies` — "导入 Cookie"
  - `clear_cookies` — "清除 Cookie"
  - `upload_file` — "上传文件"
  - `download_file` — "下载文件"
- [x] **Workspace 工作区（4 个新意图）**
  - `create_workspace` — "创建工作区 Amazon"
  - `list_workspaces` — "查看工作区"
  - `delete_workspace` — "删除工作区"
  - `move_to_workspace` — "把配置 PRF-xxx 移到 Amazon"
- [x] **Workflow 自动化编排（5 个新意图）**
  - `create_workflow` — "创建流程：抓取 Amazon 商品"
  - `list_workflows` — "查看自动化流程"
  - `run_workflow` — "运行流程 WF-xxx"
  - `delete_workflow` — "删除流程 WF-xxx"
  - `schedule_workflow` — "每天运行流程 WF-xxx"
- [x] **数据管理（4 个新意图）**
  - `export_browser_data` — "导出配置数据"
  - `import_browser_data` — "导入浏览器数据"
  - `clear_cache` — "清理缓存"
  - `clear_storage` — "清理存储"
- [x] **系统命令（3 个新意图）**
  - `system_status` — "查看系统状态"
  - `resource_usage` — "查看资源使用"
  - `view_logs` — "查看最近日志"
- [x] 帮助系统升级为 **12 个分类**
  - 新增 browser_action / workspace / data / system 四个分类
  - 帮助 topic 映射新增 25+ 关键词
- [x] 规则引擎新增 ~50 个 pattern 和 12 个 slot 提取器
- [x] 数据库新增 4 张表: workspaces / workflows / workflow_steps / proxy_pools

### Phase 9 — 列表分页与显示优化（v3.6）

- [x] **新增 5 个分页控制意图**
  - `paginate_next` — "下一页"、"继续"
  - `paginate_prev` — "上一页"
  - `paginate_to_page` — "第3页"
  - `paginate_change_page_size` — "每页20条"
  - `paginate_view_detail` — "查看第5条详情"
- [x] **6 个高频列表分页化**
  - 静态订单、动态订单、交易记录、到期IP、动态消耗、用户列表
  - 默认每页 10 条，底部统一分页导航
  - 会话级 `PaginationContext` 跟踪页码
- [x] **交易记录显示丰富化**
  - 新增序号、订单号、用户名、类型、金额、余额、备注、创建时间
- [x] **动态消耗详情显示丰富化**
  - 新增序号、用户名、类型、ID、总/剩余/下载/上传流量、状态
- [x] **用户列表显示丰富化**
  - 序号、状态、用户名、角色、激活状态、余额、代理商、备注、时间
  - 支持用户名/代理商/备注搜索
  - 权限控制：admin 全部、agent 名下、user 无权限
- [x] **query_users 意图增强**
  - 新增 4 个中文识别模式（代理商搜索、备注搜索、筛选）
  - extractSearchKeyword 新增代理商/备注提取支持
- [x] **帮助系统新增分页分类**
  - COMMANDS 新增 4 个分页命令
  - CATEGORIES 新增 "📄 翻页控制" 分类
  - catMap 新增 翻页/分页/下一页/上一页 等关键词映射

### Phase 10 — 对话历史记录功能（v3.7）

- [x] **数据模型设计**
  - 新增 Prisma `NlChatLog` 模型 + PostgreSQL `nl_chat_logs` 表
  - 字段: user_id, username, conversation_id, user_message, assistant_message, intent, confidence, slots, is_admin, is_agent, created_at
  - 索引: (user_id, created_at DESC), (created_at DESC), (intent), (username)
- [x] **持久化机制**
  - `nl.service.ts` 的 `execute()` 和 `confirm()` 入口自动保存
  - fire-and-forget 模式，不阻塞用户响应
  - 分页导航意图不单独保存（避免无意义日志）
- [x] **API 端点**
  - `GET /v1/nl/history` 带角色过滤
  - 管理员可按 user_id/username/search/intent/日期筛选
  - 非管理员只能查看自己的记录
- [x] **NL 意图集成**
  - 新增 `query_nl_history` 意图（intent-parser + executor + help-resolver）
  - 支持 9 种中文/英文触发短语
  - 管理员可查看指定用户或所有用户的历史
  - 支持分页（已加入 PAGINATED_INTENTS）
- [x] **帮助系统更新**
  - 新增 "📜 历史记录" 分类
  - 新增 `query_nl_history` 命令定义
  - catMap 新增 历史/历史记录/对话记录/聊天记录/对话历史 等关键词

### Phase 10.1 — Capability 层架构引入（v3.8）

- [x] **问题诊断**
  - `query_static_resource` 意图错误显示订单统计而非静态资源数据
  - 根因：Intent 直接绑定 Executor，缺少中间语义校验层
- [x] **Capability Registry 创建**
  - 新增 `capability-registry.ts`：Intent → Capability → API → DataFields 单一映射源
  - 覆盖所有 90+ 个已注册 intent
  - 每个 Capability 定义 `api`、`dataFields`、`phase` 等元数据
- [x] **启动时校验**
  - `nl.service.ts` 加载时调用 `validateIntentCoverage()`
  - 自动检测 INTENT_HANDLERS 中有 handler 但无 Capability 映射的 intent
  - 未映射 intent 通过 warn 日志立即暴露
- [x] **Bug 修复：query_static_resource 语义重定向**
  - 修正前：调用 Dashboard API，显示 `statistics.total_orders`（订单数）
  - 修正后：调用 `/api/settings/prices`，按国家汇总系统库存
  - 显示格式：国家名 + 可用IP数 + 产品数
  - 底部引导：提示用户查看指定国家详情、动态资源或已购订单
- [x] **文档更新**
  - 新增 §2.2 四层语义边界说明
  - 更新 §8.1 API 映射表
  - 更新 query_static_resource 槽位定义

### Phase 10.2 — 地区筛选修复（v3.9）

- [x] **问题诊断**
  - "查看伦敦的代理"只返回 4 个产品，实际系统有几十个
  - 根因：不同供应商用不同城市编码（`GBR000LON`/`GBR000000`/`GBRENGLND`）都表示伦敦
  - `resolveGeo("伦敦")` 只返回 1 个候选编码，漏掉其他供应商的产品
- [x] **城市反向映射表**
  - 构建 `CITY_NAME_TO_CODES`：从 `CITY_CODE_NAMES` 反向生成 "城市名 → 所有编码" 映射
  - 新增 `allCityCodesForName()` 导出函数
  - 新增 `expandCityCandidates()` 内部函数
- [x] **多候选集匹配**
  - `resolveGeo()` 现在对城市匹配自动展开为所有同名编码的候选集
  - 示例："伦敦" → 3 个候选 (`GBR000LON`, `GBR000000`, `GBRENGLND`)
  - "东京" → 4 个候选，"首尔" → 3 个候选
  - `matchProductCandidate` 逐候选匹配，不再遗漏任何供应商产品
- [x] **API 参数修正**
  - 产品查询从 `is_global=false` 改为 `is_global=true`
  - 与前端保持一致，确保返回完整产品目录
  - 影响范围：`executeQueryStaticResource`、`executeQueryStaticProducts`、`executePurchaseIp`

### Phase 10.3 — IP 库存分页（v3.10）

- [x] **`query_ip_inventory` 纳入统一分页系统**
  - 加入 `PAGINATED_INTENTS` 集合
  - 重写 `formatNormalQuery` 支持 page/pageSize 参数
  - 输出带序号、分页页脚的标准格式
  - 替代旧的 "...还有 N 个IP段" 截断文案
- [x] **分页模糊表达增强**
  - 下一页：新增 "往后翻"、"后面还有吗"、"看后面的"、"看下一页"
  - 上一页：新增 "往前翻"、"返回上一页"、"前面的"
  - 跳页：新增 "去第N页"、"到第N页"
  - 页大小：新增 "一页显示N个"、"多显示一点"、"展示多一点"
  - 详情：新增 "第N条详情"、"show item N"
- [x] **`paginate_view_detail` 处理逻辑**
  - 在 `handlePagination` 中新增 `handleViewDetail` 方法
  - 边界校验：序号超出当前页范围时提示可选范围
- [x] **边界处理优化**
  - 第一页上翻 → "已经是第一页了"（不再显示 "页码超出范围"）
  - 最后一页下翻 → "已经是最后一页了"
  - 页大小上限 100，下限 1
- [x] **分页响应 intent 修正**
  - `handlePagination` 返回分页命令 intent（如 `paginate_next`）而非被重放的原始查询 intent
- [x] **测试覆盖 — 37 个场景，75 步**
  - A 基础分页（6）：首页、翻页、跳页、改大小、看详情
  - B 多轮延续（4）：查询→翻页→操作
  - C 模糊表达（7）：继续、往后翻、后面还有吗、跳页、多显示一点、往前翻
  - D 上下文重置（4）：查IP→查余额→翻页、新地区重置、帮助不影响分页
  - E 边界（4）：首页上翻、999页、超序号、大页大小
  - F 前后端一致性（6）：纽约/美国/伦敦/雅加达/台北/全部
  - G 回归（6）：静态订单/动态订单/交易/动态提取/地区过滤/follow-up

### Phase 11 — 测试与上线

- [ ] 单元测试（新增意图的规则引擎匹配）
- [ ] 集成测试（NL Agent → Agent Layer → Playwright）
- [ ] E2E 测试（前端对话流程覆盖新意图）
- [ ] 安全测试（注入防护、权限隔离）
- [ ] UAT 验收测试
- [ ] 上线部署

---

## 附录 A: 用户指令示例集

| 类别 | 指令示例 | 意图 |
|------|---------|------|
| 额度管理 | "帮我给用户 user01 分配 100 元额度" | assign_balance |
| 额度管理 | "给 user02 充值 50 元" | assign_balance |
| IP 查询 | "华盛顿现在有哪些 IP" | query_ip_inventory |
| IP 查询 | "查询洛杉矶的静态 IP 价格和库存" | query_ip_inventory |
| IP 查询 | "美国有哪些地区有 IP" | query_ip_inventory |
| 统计查询 | "查询本月利润" | query_stats |
| 统计查询 | "帮我查询本月消费" | query_stats |
| 统计查询 | "查询今日订单数" | query_stats |
| 仪表盘 | "查看仪表盘数据" | query_dashboard |
| 仪表盘 | "系统概览" | query_dashboard |
| 余额 | "我的余额多少" | query_balance |
| 交易 | "查看最近交易记录" | query_transactions |
| 用户 | "查看用户列表" | query_users |
| 用户 | "搜索用户 testuser01" | query_users |
| 用户 | "代理商 agent01 的用户" | query_users |
| 分页 | "下一页" | paginate_next |
| 分页 | "继续" | paginate_next |
| 分页 | "往后翻" | paginate_next |
| 分页 | "后面还有吗" | paginate_next |
| 分页 | "上一页" | paginate_prev |
| 分页 | "往前翻" | paginate_prev |
| 分页 | "第3页" | paginate_to_page |
| 分页 | "跳到第2页" | paginate_to_page |
| 分页 | "每页20条" | paginate_change_page_size |
| 分页 | "多显示一点" | paginate_change_page_size |
| 分页 | "看第5个" | paginate_view_detail |
| 历史记录 | "查看我的历史记录" | query_nl_history |
| 历史记录 | "查看对话记录" | query_nl_history |
| 历史记录 | "我的操作历史" | query_nl_history |
| 历史记录 | "查看用户 test01 的历史" | query_nl_history |
| 历史记录 | "所有用户的操作记录" | query_nl_history |
| 历史记录 | "chat history" | query_nl_history |
| 产品 | "有哪些代理产品" | query_products |
| IP 检测 | "通过 ping0 查询这些号段" | check_ip_quality |
| 购买 | "我需要 192.168.1.0 号段 10 条" | purchase_ip |
| 订单查询 | "显示静态独享(isp)订单" | query_static_orders |
| 会话管理 | "续费会话 sess_xxx 30 天" | manage_session |
| 会话管理 | "终止会话 sess_xxx" | manage_session |
| 指纹配置 | "创建一个美国 Chrome 浏览器配置" | create_profile |
| 指纹配置 | "查看我的浏览器配置" | list_profiles |
| 指纹配置 | "复制配置 prof_xxx" | duplicate_profile |
| 指纹配置 | "给配置 prof_xxx 绑定美国代理" | bind_proxy |
| 指纹配置 | "生成一个 Windows Chrome 指纹" | generate_fingerprint |
| 指纹配置 | "批量创建 10 个日本 Firefox 配置" | batch_create_profiles |
| 浏览器操作 | "启动配置 prof_xxx 的浏览器" | launch_browser |
| 浏览器操作 | "关闭浏览器 inst_xxx" | close_browser |
| 浏览器操作 | "查看运行中的浏览器" | list_browsers |
| 浏览器操作 | "用浏览器 inst_xxx 访问 google.com" | navigate_to |
| 浏览器操作 | "截图浏览器 inst_xxx" | take_screenshot |
| 自动化任务 | "用配置 prof_xxx 抓取 example.com 数据" | submit_task |
| 自动化任务 | "查看任务 task_xxx 的状态" | query_task |
| 反检测 | "检测配置 prof_xxx 的指纹质量" | run_detection_test |
| 设置 UA | "设置配置 prof_xxx 的 UA 为 Chrome 120" | set_user_agent |
| 设置时区 | "把配置 prof_xxx 的时区改成美东时间" | set_timezone |
| 设置语言 | "设置配置的语言为英语" | set_language |
| 设置 Canvas | "设置 Canvas 为 noise 模式" | set_canvas |
| 设置 WebGL | "设置 WebGL 指纹为 noise" | set_webgl |
| 设置 Audio | "关闭 AudioContext 指纹" | set_audio |
| 禁用 WebRTC | "禁用配置 prof_xxx 的 WebRTC" | set_webrtc |
| 设置字体 | "设置字体为 Arial, Helvetica, Verdana" | set_fonts |
| 设置 Client Hints | "设置 Client Hints 平台为 Windows" | set_client_hints |
| 导入配置 | "导入浏览器配置" | import_profile |
| 导出配置 | "导出美国分组的配置" | export_profile |
| 配置分组 | "把配置 prof_xxx 移到美国分组" | group_profile |
| 配置标签 | "给配置 prof_xxx 打上 test 标签" | tag_profile |
| 添加代理 | "添加代理 socks5://user:pass@1.2.3.4:1080" | add_proxy |
| 导入代理 | "批量导入代理" | import_proxy |
| 测试代理 | "测试代理 prx_xxx 的连通性" | verify_proxy |
| 轮换代理 | "轮换配置 prof_xxx 的代理" | rotate_proxy |
| 代理列表 | "查看可用的美国代理" | list_proxy |
| 指纹校验 | "检查配置 prof_xxx 的指纹一致性" | validate_fingerprint |
| 自动匹配 | "为配置 prof_xxx 自动匹配最佳代理" | auto_match_proxy |
| 重启浏览器 | "重启浏览器 inst_xxx" | restart_browser |
| 批量启动 | "批量启动美国分组的所有浏览器" | batch_launch_browser |
| 批量关闭 | "关闭所有浏览器" | batch_close_browser |
| 运行脚本 | "在浏览器 inst_xxx 中获取页面标题" | run_script |
| 定时任务 | "1 小时后用配置 prof_xxx 截图 example.com" | schedule_task |
| 批量任务 | "批量截图这 5 个网站" | batch_task |
| 暂停配置 | "暂停配置 prof_xxx" | pause_profile |
| 恢复配置 | "恢复配置 prof_xxx" | resume_profile |
| 归档配置 | "归档配置 prof_xxx" | archive_profile |
| 设置 OS | "设置操作系统为 Windows" | set_os |
| 设置 CPU | "设置 CPU 为 8 核" | set_cpu |
| 设置内存 | "设置内存为 16GB" | set_memory |
| 设置 GPU | "设置 GPU 为 RTX 3060" | set_gpu |
| 设置屏幕 | "设置分辨率为 1920x1080" | set_screen |
| 设置 Battery | "关闭 Battery API" | set_battery |
| 设置 WebGPU | "设置 WebGPU 指纹" | set_webgpu |
| 删除代理 | "删除代理 prx_xxx" | delete_proxy |
| 代理测速 | "测试代理 prx_xxx 速度" | proxy_speed_test |
| 代理池 | "创建代理池 美国住宅" | create_proxy_pool |
| 点击元素 | "在浏览器 inst_xxx 点击 #login" | click_element |
| 输入文本 | "在输入框 #search 输入 iphone" | input_text |
| 滚动页面 | "向下滚动页面" | scroll_page |
| 提取文本 | "提取页面文本内容" | extract_text |
| 提取链接 | "提取页面所有链接" | extract_links |
| 提取表格 | "提取页面表格数据" | extract_table |
| 导出 Cookie | "导出浏览器 inst_xxx 的 Cookie" | export_cookies |
| 清除 Cookie | "清除浏览器 Cookie" | clear_cookies |
| 创建工作区 | "创建工作区 Amazon" | create_workspace |
| 查看工作区 | "查看工作区" | list_workspaces |
| 移动到工作区 | "把配置 prof_xxx 移到 Amazon" | move_to_workspace |
| 删除工作区 | "删除工作区 Amazon" | delete_workspace |
| 创建流程 | "创建流程：抓取 Amazon 商品" | create_workflow |
| 查看流程 | "查看自动化流程" | list_workflows |
| 运行流程 | "运行流程 wf_xxx" | run_workflow |
| 删除流程 | "删除流程 wf_xxx" | delete_workflow |
| 导出数据 | "导出配置 prof_xxx 的数据" | export_browser_data |
| 清理缓存 | "清理配置 prof_xxx 的缓存" | clear_cache |
| 清理存储 | "清理配置 prof_xxx 的存储" | clear_storage |
| 系统状态 | "查看系统状态" | system_status |
| 资源使用 | "查看资源使用" | resource_usage |
| 查看日志 | "查看最近日志" | view_logs |

---

## 附录 B: 错误消息模板

| 场景 | 消息 |
|------|------|
| 意图不明 | "抱歉，我暂时无法理解这个指令。你可以试试以下操作：[建议列表]" |
| 缺少参数 | "请补充信息：您要给哪个用户分配额度？金额是多少？" |
| 权限不足 | "抱歉，您没有执行此操作的权限。需要代理商或管理员权限。" |
| 用户不存在 | "未找到用户 '{username}'，请检查用户名是否正确。" |
| 余额不足 | "余额不足，当前余额 ¥{balance}，需要 ¥{required}。" |
| API 错误 | "操作失败: {error_message}。请稍后重试或联系管理员。" |
| 频率限制 | "操作太频繁，请稍等 {seconds} 秒后重试。" |
| 未登录 | "请先登录后再使用 Agent 功能。" |

---

## Phase 11 — 多轮对话上下文系统（v4.0）

### 问题诊断

用户输入 "英国有哪些代理" 后系统返回 4 个产品，但当用户接着输入 "帮我挑两个质量好的" 时，系统无法关联上下文，返回"请指定要查找的地区"。本质原因：

1. `ruleParseIntent` 是纯函数，不接收任何会话状态
2. 虽然 `slotsMemory` 记忆了 country/city，但无法记忆查询结果
3. LLM parser 只接收文本消息，不了解上次返回了哪些产品

### 解决方案：四层上下文关联

```
Turn 1 (查询)
  ↓ executor 返回结果
  ↓ saveLastResult → conv.lastResult (items[])

Turn 2 (跟进)
  ↓ ruleParseIntent → unknown
  ↓ tryFollowUp(message, conv)
    ↓ detectFollowUp(text) → FollowUpInfo
    ↓ if (lastResult && age < 10min):
      return { intent: follow_up_*, slots: { _followUp, _lastResult } }

  ↓ executeFollowUpRecommend / Select / Action / Refine
    ↓ 从 lastResult.items 排序、筛选、选取
    ↓ 返回推荐结果 + 后续操作建议
```

### 修改文件

| 文件 | 修改 |
|------|------|
| `conversation-context.ts` | 新增 `LastResult` interface，添加到 `Conversation` |
| `intent-parser.ts` | 新增 `FollowUpInfo` / `FollowUpRule` 类型，`detectFollowUp()` 函数 |
| `nl.service.ts` | 新增 `tryFollowUp()` / `saveLastResult()`，增强 `buildConversationContext()` |
| `executor.ts` | 新增 4 个 executor: `executeFollowUpSelect/Recommend/Action/Refine` |
| `capability-registry.ts` | 注册 4 个跟进意图的 Capability 映射 |

### 跟进模式识别（intent-parser.ts）

```typescript
// 选择型："选第2个"、"要三条"
/(?:选|要|挑|选择|拿|取)(?:第?\s*)?([...]+)\s*(?:个|条)?/

// 推荐型："帮我挑两个质量好的"
/(?:帮我?|帮忙)?(?:挑|选|推荐).*?(?:最?好|质量|稳定|best|quality)/i

// 操作型："帮我开通"、"买第1个"
/(?:帮我?|帮忙)?(?:开通|购买|买|下单|开|buy|purchase)\s*(?:这|它|...)?/i

// 筛选型："便宜的"、"库存最多的"
/(?:便宜|cheap|价格低|低价|cost\s*low)/i
```

### 关键设计决策

1. **10 分钟有效期**：`lastResult.timestamp` 超过 10 分钟后不再用于跟进
2. **优先级顺序**：`ruleParseIntent` > `tryFollowUp` > `resolveReference` > `llmParse`
3. **follow_up_action 需确认**：购买操作自动设置 `confirmationRequired: true`
4. **结果数据提取**：`extractItems()` 自动从 data 中找到数组类型的字段（products/list/orders 等）

---

## Phase 12 — NER 优先 + IP 级查询意图（v4.1）

### 问题诊断

用户输入 "160.250.198.41什么时候到期"，系统执行 `query_expiring_ips`（到期IP列表）而非查询该具体 IP。根因：

1. 系统缺少 **IP 级查询意图**（`query_ip_info`）
2. 意图匹配时没有 **NER 优先规则**，模式 `/(?:什么时候).*(?:到期)/` 先命中了列表查询
3. 系统的意图层级不完整：有"列表查询"但无"单实体查询"

### 实施内容

#### 1. 新增 `query_ip_info` 意图

- 9 个匹配模式覆盖中英文
- `extractIpAddress` 槽位提取器
- 模式放在 `query_expiring_ips` **之前**（更具体的优先）

#### 2. NER 前置检查（`nerPreCheck`）

在 `ruleParseIntent` 中：当模式匹配命中了一个不处理具体 IP 的意图，但输入中包含有效 IPv4 地址时，**覆盖为 `query_ip_info`**。

```typescript
if (
  IP_ADDR_RE.test(normalized) &&
  !IP_SPECIFIC_INTENTS.has(def.intent)
) {
  const ner = nerPreCheck(normalized, lang);
  if (ner) return ner;
}
```

#### 3. `query_expiring_ips` 模式加固

对容易误命中的模式（如 "什么时候到期"、"到期时间"）加上 IP 地址负向断言：

```regex
/^(?!.*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*(?:什么时候).*(?:到期)/i
```

#### 4. `executeQueryIpInfo` executor

查询用户所有活跃静态订单，遍历 instances 匹配目标 IP，返回：
- 代理连接信息（IP:Port:User:Pass）
- 地区信息
- 到期时间 + 剩余天数状态标签（🟢/🟡/⚠️/❌）
- 订单号 + 续费建议

#### 验证结果

| 输入 | 意图 | 槽位 |
|------|------|------|
| 160.250.198.41什么时候到期 | query_ip_info | ip: 160.250.198.41 |
| 查询160.250.198.41 | query_ip_info | ip: 160.250.198.41 |
| 哪些IP快到期 | query_expiring_ips | — |
| 我的IP什么时候到期 | query_expiring_ips | — |
| 160.250.198.41 | query_ip_info | ip: 160.250.198.41 |

### 修改文件

| 文件 | 修改 |
|------|------|
| `intent-parser.ts` | 新增 `query_ip_info` 模式、`extractIpAddress`、`nerPreCheck`、NER 优先逻辑 |
| `executor.ts` | 新增 `executeQueryIpInfo`，注册到 `INTENT_HANDLERS` |
| `capability-registry.ts` | 注册 `query_ip_info` → `IP_INFO_QUERY` |

### 设计原则

**实体识别优先于意图匹配**：当输入包含明确实体（IP 地址、订单号等），应先确定实体类型，再基于实体类型缩小意图候选范围。后续可扩展到订单号 NER、用户名 NER 等。

---

## Phase 13 — 代理二维码/链接生成（v4.2）

### 功能说明

用户可以通过自然语言为指定 IP 生成 Shadowrocket / Clash / V2Ray 等客户端可扫描的代理链接，支持三种协议：

| 协议 | 链接格式 | 说明 |
|------|----------|------|
| SOCKS5 | `socks://base64(user:pwd@host:port)` | Base64 编码，Shadowrocket 推荐 |
| HTTP | `http://user:pwd@host:port` | 标准 HTTP 代理 |
| HTTPS | `https://user:pwd@host:port` | 标准 HTTPS 代理 |

### 新增意图

**`generate_proxy_qr`**

| 属性 | 值 |
|------|------|
| 槽位 | `ip`（IP 地址）、`protocol`（socks5/http/https）、`order_no`（订单号） |
| 确认 | 不需要 |
| 权限 | admin / user（代理商不可用） |

### 模糊表达识别

| 输入示例 | 识别意图 | 提取槽位 |
|----------|----------|----------|
| "163.61.209.63 二维码" | generate_proxy_qr | ip: 163.61.209.63 |
| "生成socks5链接 163.61.209.63" | generate_proxy_qr | ip: 163.61.209.63, protocol: socks5 |
| "shadowrocket 160.250.198.41" | generate_proxy_qr | ip: 160.250.198.41 |
| "帮我生成二维码" | generate_proxy_qr | （提示输入 IP） |
| "扫码连接" | generate_proxy_qr | （提示输入 IP） |
| "QR code for 163.61.209.63" | generate_proxy_qr | ip: 163.61.209.63 |

### NER 参数提取

- **IP 地址**：`extractIpAddress` — 匹配 IPv4 格式
- **协议**：`extractProxyProtocol` — 识别 socks5/http/https 关键词
- **订单号**：`extractOrderNo` — 复用现有提取器

### 交互示例

```
用户: 163.61.209.63 二维码

系统:
请使用 Shadowrocket 扫描二维码【建议 SOCKS5 协议】

**HTTP**

**HTTPS**

**SOCKS5**

代理地址：163.61.209.63
端口：30000
用户名：q10s9fz
密码：tLta3FFS
地区：英国-伦敦
到期：2026-04-10 00:00
订单：STA20260310082542iu8ewi

链接：socks://cTEwczlmejp0THRhM0ZGU0AxNjMuNjEuMjA5LjYzOjMwMDAw
注意：SOCKS5 链接已使用 Base64 编码格式，适用于大多数代理客户端
```

### 修改文件

| 文件 | 修改 |
|------|------|
| `intent-parser.ts` | 新增 `generate_proxy_qr` 模式（9 条）、`extractProxyProtocol`、加入 NER 白名单 |
| `executor.ts` | 新增 `executeGenerateProxyQr`、`buildProxyUrls`、`toBase64` |
| `capability-registry.ts` | 注册 `PROXY_QR_GENERATE` |
| `help-resolver.ts` | 新增帮助条目和关键词映射 |
| `intent-test-fixtures.json` | 新增 8 条 generate_proxy_qr + 6 条 query_ip_info 测试用例 |

### 前端集成说明

executor 返回的 `data` 包含结构化字段，前端可直接用于渲染 QR 组件：

```typescript
data: {
  ip: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  urls: {
    socks5: string;  // socks://base64(...)
    http: string;    // http://user:pwd@host:port
    https: string;   // https://user:pwd@host:port
  };
  orderNo: string;
  expire: string;
  region: string;
}
```

---

## Phase 13.1 — 城市多编码产品匹配修复（v2.8）

### 问题描述

用户输入"伦敦的IP"或"英国伦敦的IP"时，只返回部分伦敦产品（4 个），
而系统中实际有更多。根因：`matchProductCandidate` 只检查 `p.city` 字段，
但部分供应商将城市编码存放在 `p.area` 或 `p.state` 字段。

### 修复内容

1. **`matchProductCandidate` 三字段统一匹配**
   - 候选 cityCode 现在同时匹配 `city`、`area`、`state` 三个字段
   - 名称回退匹配也包含 `area` 字段的中文映射

2. **`deduplicateProducts` 去重**
   - 按 `product_no`（优先）或 `ipRange|country|price` 组合键去重
   - 防止跨供应商匹配导致产品重复

3. **`geoDebug` 调试输出**
   - `data.geoDebug` 包含 `input`、`cityCandidates`、
     `matchedNames`、`matchedCount`

### Before / After

| 查询 | Before | After |
|------|--------|-------|
| 伦敦的IP | 仅 `city=GBR000LON` 匹配 → 4 个 | `city/area/state` 含 `GBR000LON/GBRENGLND/GBR000000` 均匹配 |
| 英国伦敦的IP | 同上 | 同上，候选集一致 |

### 修改的文件

| 文件 | 变更 |
|------|------|
| `executor.ts` | `matchProductCandidate` 三字段匹配、`deduplicateProducts` 去重、`geoDebug` |
| `intent-test-fixtures.json` | 新增 `geo_multi_code_city` 测试分类 4 条用例 |
| `nexalayerNL.md` | 文档更新 |

---

*文档结束 — 请 Review 后进入编码阶段*
