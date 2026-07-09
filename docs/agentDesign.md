# AI Agent 网络执行层 — 系统设计文档

> **版本**: v3.0  
> **日期**: 2026-03-08  
> **作者**: System Architect  
> **状态**: Phase 4 设计 — Agent Browser OS
> 
> **v3.0 变更摘要**:  
> - 战略升级：从「AI Agent 网络执行层」升级为「AI Agent 网络执行层 + 指纹浏览器操作系统」  
> - NL 命令架构升级为 **9 大模块**：账户、配置、指纹、代理、浏览器、自动化、工作区、数据、系统  
> - 新增 Phase 4：Agent Browser OS（Workspace、Workflow、扩展指纹 20+、浏览器页面操作、数据管理、系统命令）  
> - 新增 3 张数据库表：workspaces、workflows、workflow_steps  
> - NL Agent 从 70 意图扩展到 **120+ 意图**  
> - 新增 Workspace 管理、Workflow 编排、代理池、Cookie 管理、数据提取等关键能力  
> - 指纹维度从 10 扩展到 **21 个**（新增 GPU/CPU/Memory/Screen/MediaDevices/Battery/WebGPU 等）  
> - 浏览器操作从 2 个扩展到 **15+ 个**（新增 click/input/scroll/extract/cookie 管理等）  
> 
> **v2.0 变更摘要**:  
> - 新增 Phase 2：指纹配置模块（Profile）、风险评分、智能调度、批量管理  
> - 新增 Phase 3：浏览器实例管理、自动化引擎、任务队列、反检测引擎、MCP 接口  
> - 新增 4 个核心模块：Profile、Fingerprint、Browser、Task  
> - 新增 6 张数据库表  
> - 新增 30+ API 端点覆盖指纹浏览器全功能  
> 
> **v1.1 变更摘要**:  
> - 认证简化：支持纯 API Key 直接认证模式  
> - 新增 Telemetry 模块与上报接口  
> - Session 创建改为异步模式

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统定位与架构总览](#2-系统定位与架构总览)
3. [技术选型](#3-技术选型)
4. [系统架构设计](#4-系统架构设计)
5. [数据库设计](#5-数据库设计)
6. [API 接口设计](#6-api-接口设计)
7. [核心业务流程](#7-核心业务流程)
8. [安全设计](#8-安全设计)
9. [部署架构](#9-部署架构)
10. [可观测性与监控](#10-可观测性与监控)
11. [扩展规划](#11-扩展规划)
12. [目录结构](#12-目录结构)

---

## 1. 项目概述

### 1.1 背景

我们已经拥有一套完整的 IP 代理管理系统（以下简称"代理后端"），支持静态代理和动态代理的全生命周期管理，包括用户管理、订单管理、流量管理、支付等。前端通过 REST API 与后端交互。

随着 AI Agent 生态的发展，越来越多的 AI Agent 需要使用代理 IP 来执行网络任务（爬虫、数据采集、合规检测、多地域测试等）。当前系统的 API 主要面向人类用户操作，不适合 AI Agent 直接调用。

### 1.2 目标

构建 **AI Agent 网络执行层 + 指纹浏览器操作系统**（以下简称 Agent Layer / Agent Browser OS），为 AI Agent 提供完整的网络交互基础设施：

- **Agent 友好的 API**：语义化、幂等、自描述的 RESTful API
- **Session 管理**：代理会话的创建、管理、轮换、销毁
- **资源抽象**：屏蔽底层静态/动态代理的差异，提供统一的代理资源接口
- **自助服务**：注册、充值、购买、续费的全流程自助化
- **智能调度**：根据需求自动选择最优代理类型和地域
- **指纹浏览器 OS**：完整的浏览器配置、21+ 指纹维度、生命周期管理
- **浏览器自动化**：页面操作（点击/输入/滚动/提取）、Cookie 管理、JS 执行
- **Workflow 编排**：多步骤自动化流程、定时调度、重试策略、任务队列
- **Workspace 管理**：工作区/文件夹/标签/分组，支撑大规模配置管理
- **NL Agent OS CLI**：AI Agent 通过自然语言控制浏览器 + 代理 + 自动化的统一入口

### 1.3 核心原则

| 原则 | 说明 |
|------|------|
| **Agent-First** | API 设计优先考虑程序化调用，而非人类操作 |
| **幂等性** | 所有写操作支持幂等，Agent 可安全重试 |
| **自描述** | 返回值包含足够的上下文，减少 Agent 的额外查询 |
| **最小权限** | Agent 只能访问自己的资源，严格隔离 |
| **向下兼容** | 底层完全复用现有代理后端，不修改已有系统 |

---

## 2. 系统定位与架构总览

### 2.1 系统定位

```
┌──────────────────────────────────────────────────────┐
│                    AI Agent 生态                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Agent A │  │ Agent B │  │ Agent C │  │  MCP    │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │
│       │            │            │             │      │
└───────┼────────────┼────────────┼─────────────┼──────┘
        │            │            │             │
        ▼            ▼            ▼             ▼
┌──────────────────────────────────────────────────────┐
│          AI Agent 网络执行层 (Agent Layer)              │
│  ┌──────────────────────────────────────────────────┐ │
│  │              API Gateway / Router                │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  认证鉴权 │ 会话管理 │ 资源调度 │ 计费追踪      │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  指纹配置 │ 浏览器实例 │ 自动化引擎 │ 任务队列  │ │ ← Phase 2/3
│  ├──────────────────────────────────────────────────┤ │
│  │        反检测引擎 │ MCP Server │ NL Agent        │ │
│  ├──────────────────────────────────────────────────┤ │
│  │           Agent PostgreSQL Database              │ │
│  └──────────────────────────────────────────────────┘ │
│                    │                │                  │
│            内部 HTTP 调用     浏览器引擎调度            │
│    (surprising-rejoicing      (Playwright/            │
│     .railway.internal)         Chromium CDP)          │
│                    │                │                  │
└────────────────────┼────────────────┼─────────────────┘
                     ▼                ▼
┌────────────────────────┐  ┌──────────────────────────┐
│  现有 IP 代理管理系统    │  │  浏览器运行环境            │
│  (Backend)              │  │  ┌────────┐ ┌────────┐  │
│  ┌────────┐ ┌────────┐ │  │  │Chromium│ │Firefox │  │
│  │用户管理│ │订单管理│ │  │  └────────┘ └────────┘  │
│  ├────────┤ ├────────┤ │  │  ┌────────────────────┐  │
│  │代理服务│ │支付系统│ │  │  │ 指纹注入引擎         │  │
│  └────────┘ └────────┘ │  │  │ (Canvas/WebGL/      │  │
│           │             │  │  │  Audio/WebRTC)      │  │
│  底层代理资源供应商      │  │  └────────────────────┘  │
│  ┌──────┐┌──────┐┌───┐ │  └──────────────────────────┘
│  │IPIPV ││IPWEB ││LM │ │
│  └──────┘└──────┘└───┘ │
└────────────────────────┘
```

### 2.2 Agent Layer 的职责边界

| 职责 | Agent Layer | 代理后端 |
|------|:-----------:|:--------:|
| Agent 认证 (API Key) | ✅ | ❌ |
| 会话管理 (Session) | ✅ | ❌ |
| 代理类型智能选择 | ✅ | ❌ |
| **指纹配置管理 (Profile)** | ✅ | ❌ |
| **浏览器实例管理** | ✅ | ❌ |
| **浏览器自动化引擎** | ✅ | ❌ |
| **任务队列调度** | ✅ | ❌ |
| **反检测引擎** | ✅ | ❌ |
| **MCP Server 接口** | ✅ | ❌ |
| 用户/账号管理 | 代理转发 | ✅ |
| 订单创建/续费 | 代理转发 | ✅ |
| 代理 IP 分配 | 代理转发 | ✅ |
| 流量查询/管理 | 代理转发 | ✅ |
| 余额/充值 | 代理转发 | ✅ |
| 使用量统计聚合 | ✅ | 部分 |
| 代理健康检测 | ✅ | ❌ |

---

## 3. 技术选型

### 3.1 技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| **语言** | TypeScript (Node.js) | 前端团队熟悉；异步 I/O 天然适合代理网关 |
| **框架** | Fastify | 高性能、插件化、TypeScript 原生支持 |
| **ORM** | Prisma | 类型安全、自动迁移、优秀的 DX |
| **数据库** | PostgreSQL | Railway 原生支持，与现有系统一致 |
| **缓存** | 内存缓存 (node-cache) | 初期轻量，后续可切 Redis |
| **HTTP Client** | undici / fetch | Node.js 原生高性能 HTTP 客户端 |
| **验证** | Zod | 运行时类型验证，与 TypeScript 完美集成 |
| **日志** | Pino | Fastify 默认日志库，JSON 结构化日志 |
| **部署** | Railway | 与现有系统同平台，内网通信低延迟 |

### 3.2 为什么选 TypeScript + Fastify？

1. **性能**：Fastify 是 Node.js 最快的 Web 框架之一，吞吐量高
2. **类型安全**：TypeScript + Zod + Prisma 实现端到端类型安全
3. **生态**：npm 生态丰富，代理/网络相关库完善
4. **团队**：与前端技术栈统一，降低维护成本
5. **异步**：Node.js 事件循环天然适合 I/O 密集的代理网关场景

---

## 4. 系统架构设计

### 4.1 分层架构

```
┌─────────────────────────────────────────────┐
│                 API Layer                    │
│  Routes → Validation → Controller           │
├─────────────────────────────────────────────┤
│               Service Layer                  │
│  SessionService   │ ProxyService             │
│  AccountService   │ BillingService           │
│  ProfileService   │ FingerprintService  ← P2 │
│  BrowserService   │ TaskService         ← P3 │
│  AutomationService│ AntiDetectService   ← P3 │
├─────────────────────────────────────────────┤
│              Engine Layer (Phase 3)          │
│  Playwright Controller │ CDP Bridge          │
│  Fingerprint Injector  │ Task Scheduler      │
├─────────────────────────────────────────────┤
│              Gateway Layer                   │
│  BackendClient (HTTP → 代理后端)             │
├─────────────────────────────────────────────┤
│             Data Access Layer                │
│  Prisma ORM → PostgreSQL                    │
└─────────────────────────────────────────────┘
```

### 4.2 核心模块

#### 4.2.1 认证模块 (Auth Module)

支持两种认证模式，**AI Agent 推荐使用模式一**：

**模式一：纯 API Key 认证（推荐）**
- 每次请求通过 `X-API-Key` Header 直接认证
- 无需 Token 管理，零维护成本
- 适合 AI Agent 场景，无 token refresh 负担

**模式二：JWT Token 认证（高安全场景）**
- API Key + Secret 换取短期 JWT Token
- 适合人类控制台、Web Dashboard
- Token 有效期 1 小时，支持刷新

**权限控制**：基于 Agent 角色的细粒度权限管理  
**频率限制**：per-key 的请求频率限制

```
模式一（推荐 Agent）:
Agent Request → X-API-Key Header → 鉴权 → 频率限制 → 路由

模式二（控制台）:
API Key + Secret → JWT 签发 → Bearer Token → 鉴权 → 路由
```

#### 4.2.2 账户模块 (Account Module)

Agent 在本系统注册后，Agent Layer 会自动在代理后端创建对应的用户账号，形成 1:1 映射。

```
Agent Account (Agent Layer)
    │
    ├── agent_id (本地)
    ├── api_key / api_secret
    ├── backend_user_id (映射到代理后端)
    ├── backend_username
    └── backend_token (缓存)
```

#### 4.2.3 会话模块 (Session Module)

Session 是本系统的核心抽象概念。一个 Session 代表一个代理使用会话，封装了底层代理资源的复杂性。

```
Session
    │
    ├── session_id (唯一标识)
    ├── type: static | dynamic
    ├── status: creating | active | rotating
    │           | expired | error
    ├── identity (身份抽象，用于未来智能调度)
    │   ├── identity_id (关联同一身份的多个 Session)
    │   └── identity_pool (身份池归属)
    ├── proxy_config
    │   ├── host / port / username
    │   ├── password (AES-256-GCM 加密存储)
    │   ├── protocol: socks5 | http | https
    │   └── country / city / isp
    ├── rotation_policy
    │   ├── mode: fixed | timed | on_demand
    │   └── interval_seconds
    ├── health (健康/风控指标)
    │   ├── risk_level: low | medium | high
    │   ├── health_score: 0-100
    │   ├── success_rate: 0.0-1.0
    │   ├── consecutive_failures: number
    │   └── last_error_type: string
    ├── underlying_resource
    │   ├── order_no (代理后端订单号)
    │   ├── product_no (产品编号)
    │   └── instance_id (实例ID)
    └── usage
        ├── bytes_used
        ├── requests_count
        └── created_at / expires_at
```

> **设计要点**: Session 不仅是资源抽象，也是**执行抽象**。
> 通过 Telemetry 上报机制，Session 可以感知代理的
> 真实使用效果，为未来智能调度提供数据基础。

#### 4.2.4 代理服务模块 (Proxy Service Module)

负责与代理后端交互，完成实际的代理资源操作。

```
ProxyService
    │
    ├── StaticProxyManager
    │   ├── createStaticProxy()    → 开通静态IP
    │   ├── renewStaticProxy()     → 续费静态IP
    │   ├── releaseStaticProxy()   → 释放静态IP
    │   └── queryStaticProxy()     → 查询静态IP状态
    │
    ├── DynamicProxyManager
    │   ├── createDynamicProxy()   → 开通动态代理
    │   ├── extractProxy()         → 提取代理IP
    │   ├── rotateProxy()          → 轮换代理IP
    │   └── queryDynamicUsage()    → 查询流量使用
    │
    └── SmartRouter
        ├── recommend()            → 根据需求推荐代理类型
        └── autoSelect()           → 自动选择最优代理
```

#### 4.2.5 计费追踪模块 (Billing Module)

```
BillingService
    │
    ├── getBalance()        → 查询余额
    ├── recharge()          → 充值（调用代理后端）
    ├── getUsageReport()    → 使用报告
    └── getCostBreakdown()  → 费用明细
```

#### 4.2.6 遥测模块 (Telemetry Module)

**这是 Agent Layer 区别于普通代理网关的核心能力**。Agent 通过上报使用事件（如 HTTP 403、验证码、超时等），形成数据闭环，驱动未来的风险评分和智能调度。

```
TelemetryService
    │
    ├── reportEvent()        → 接收 Agent 上报事件
    ├── updateSessionHealth() → 更新 Session 健康指标
    ├── calculateRiskLevel()  → 计算风险等级（Phase 2）
    └── getSessionMetrics()   → 获取 Session 指标聚合
```

**事件上报数据模型**:
```
TelemetryEvent
    ├── session_id
    ├── event_type: http_error | captcha | timeout
    │               | block | success | custom
    ├── status_code: 403 / 429 / 503 / ...
    ├── target_url (可选，脱敏)
    ├── latency_ms
    ├── error_message
    └── metadata (自定义扩展字段)
```

**MVP 阶段**：收集数据 + 更新 Session 健康指标  
**Phase 2**：基于数据驱动风险评分 + 智能调度

#### 4.2.7 指纹配置模块 (Profile Module) — Phase 2

**这是指纹浏览器的核心数据层**。Profile 代表一个完整的浏览器环境配置，每个 Profile 拥有独立的指纹参数、代理绑定和数据隔离。

```
ProfileService
    │
    ├── createProfile()        → 创建浏览器配置
    ├── updateProfile()        → 更新配置参数
    ├── deleteProfile()        → 删除配置
    ├── getProfile()           → 获取配置详情
    ├── listProfiles()         → 列表查询（支持分组/标签/状态筛选）
    ├── duplicateProfile()     → 克隆配置
    ├── batchCreateProfiles()  → 批量创建
    ├── importProfiles()       → 导入配置（JSON/CSV）
    ├── exportProfiles()       → 导出配置
    ├── transferProfile()      → 团队间转移配置
    ├── importProfiles()       → 从 JSON/CSV 批量导入配置
    ├── exportProfiles()       → 导出配置（含可选 Cookie 备份）
    ├── groupProfile()         → 将配置移入/移出分组
    └── tagProfile()           → 给配置添加/移除标签

ProxyManagerService
    │
    ├── addProxy()             → 添加外部代理（非平台代理）
    ├── importProxies()        → 从文件批量导入代理
    ├── verifyProxy()          → 测试代理连通性和匿名性
    ├── rotateProxy()          → 为 Profile 轮换代理
    ├── listProxies()          → 列表查询可用代理
    └── deleteProxy()          → 删除代理

FingerprintService
    │
    ├── generateFingerprint()  → 根据 OS/Browser/Device 随机生成完整指纹
    ├── validateFingerprint()  → 校验指纹参数一致性
    ├── getTemplates()         → 获取真实设备指纹模板库
    ├── customizeFingerprint() → 精细化自定义单项参数
    └── diffFingerprint()      → 对比两个指纹的差异

ProxyBindingService
    │
    ├── bindSession()          → 将 Session（代理）绑定到 Profile
    ├── unbindSession()        → 解除绑定
    ├── autoMatchProxy()       → 根据 Profile 地理位置自动匹配代理
    └── validateConsistency()  → 校验代理-指纹一致性（时区/语言/Geo）
```

**Profile 数据模型**:

```
BrowserProfile
    │
    ├── profile_id (唯一标识)
    ├── name / tags / group
    ├── status: active | archived | locked
    │
    ├── fingerprint_config (指纹配置)
    │   ├── os: windows | macos | linux | android | ios
    │   ├── browser: chrome | firefox | edge | safari
    │   ├── browser_version: "120.0.6099.109"
    │   ├── user_agent: 完整 UA 字符串
    │   ├── platform: "Win32" | "MacIntel" | ...
    │   │
    │   ├── screen (屏幕)
    │   │   ├── width / height / color_depth
    │   │   ├── device_pixel_ratio
    │   │   └── avail_width / avail_height
    │   │
    │   ├── hardware (硬件)
    │   │   ├── cpu_cores: 4 | 8 | 16
    │   │   ├── memory_gb: 4 | 8 | 16 | 32
    │   │   ├── gpu_vendor / gpu_renderer
    │   │   └── max_touch_points
    │   │
    │   ├── canvas (Canvas 指纹)
    │   │   ├── mode: noise | block | real
    │   │   └── noise_seed (噪声种子)
    │   │
    │   ├── webgl (WebGL 指纹)
    │   │   ├── mode: noise | block | real
    │   │   ├── vendor / renderer
    │   │   ├── unmasked_vendor / unmasked_renderer
    │   │   └── noise_seed
    │   │
    │   ├── audio (AudioContext 指纹)
    │   │   ├── mode: noise | block | real
    │   │   └── noise_seed
    │   │
    │   ├── webrtc (WebRTC 控制)
    │   │   ├── mode: real | disabled | fake
    │   │   ├── public_ip (伪装公网 IP)
    │   │   └── local_ips (伪装内网 IP 列表)
    │   │
    │   ├── location (地理定位)
    │   │   ├── timezone: "America/New_York"
    │   │   ├── locale: "en-US"
    │   │   ├── languages: ["en-US", "en"]
    │   │   ├── geo_latitude / geo_longitude
    │   │   └── geo_accuracy
    │   │
    │   ├── fonts: ["Arial", "Helvetica", ...]
    │   ├── plugins: [{ name, filename, description }]
    │   │
    │   ├── client_hints (Client Hints)
    │   │   ├── brands / mobile / platform
    │   │   ├── platform_version / architecture
    │   │   └── bitness / model
    │   │
    │   ├── media_devices (媒体设备)
    │   │   ├── audio_inputs / audio_outputs
    │   │   └── video_inputs
    │   │
    │   └── misc (杂项)
    │       ├── do_not_track: true | false | null
    │       ├── hardware_concurrency
    │       ├── device_memory
    │       └── battery_charging / battery_level
    │
    ├── proxy_binding (代理绑定)
    │   ├── session_id (关联 Session)
    │   ├── proxy_url (缓存的代理地址)
    │   └── auto_match: true | false
    │
    ├── storage (数据隔离)
    │   ├── cookies_encrypted (加密存储)
    │   ├── local_storage_encrypted
    │   └── extensions: [{ id, config }]
    │
    └── metadata
        ├── last_launched_at
        ├── launch_count
        ├── notes
        └── created_at / updated_at
```

> **设计要点**: Profile 不是简单的参数集合，而是一个
> **完整的数字身份**。它包含指纹参数、代理绑定、
> Cookie/LocalStorage 数据、浏览器扩展配置，形成一个
> 独立且持久化的浏览器环境。

#### 4.2.8 浏览器实例模块 (Browser Module) — Phase 3

管理浏览器实例的生命周期，基于 Playwright 实现。

```
BrowserService
    │
    ├── launch()               → 启动浏览器实例（加载 Profile 指纹）
    ├── close()                → 关闭浏览器实例（force 选项强制杀进程）
    ├── restart()              → 重启浏览器实例（保持 Profile 不变）
    ├── listInstances()        → 查看运行中的实例
    ├── getInstanceStatus()    → 获取实例状态/资源占用
    ├── batchLaunch()          → 批量启动
    └── batchClose()           → 批量关闭

AutomationService
    │
    ├── navigateTo()           → 导航到 URL
    ├── click()                → 点击元素
    ├── type()                 → 输入文本
    ├── fill()                 → 填充表单字段（清空后输入）
    ├── hover()                → 悬停元素
    ├── drag()                 → 拖拽元素（dragAndDrop）
    ├── select()               → 选择下拉选项
    ├── scroll()               → 滚动页面
    ├── press()                → 按键（Enter / Escape / Tab 等）
    ├── keyboard()             → 键盘操作（组合键、keyDown/keyUp）
    ├── mouse()                → 鼠标操作（移动、点击坐标、拖动）
    ├── uploadFile()           → 上传文件（setInputFiles）
    ├── downloadFile()         → 下载文件（等待下载事件）
    ├── waitFor()              → 等待元素/条件
    ├── evaluate()             → 执行 JS 脚本
    ├── takeScreenshot()       → 截图
    ├── exportPdf()            → 导出 PDF
    ├── getCookies()           → 获取 Cookie
    ├── setCookies()           → 设置 Cookie
    ├── getPageContent()       → 获取页面内容
    │
    ├── interceptRequest()     → 拦截/修改/阻止请求（page.route）
    ├── interceptResponse()    → 拦截/修改响应内容
    └── networkMonitor()       → 网络活动监控（HAR 录制）

AntiDetectService
    │
    ├── runDetectionTest()     → 对当前实例运行检测测试
    ├── checkLeaks()           → 检查 DNS/WebRTC/Canvas 泄漏
    ├── validateConsistency()  → 校验指纹各项参数一致性
    └── getDetectionReport()   → 生成反检测报告
```

**浏览器实例数据模型**:

```
BrowserInstance
    │
    ├── instance_id (唯一标识)
    ├── profile_id (关联 Profile)
    ├── agent_id (归属 Agent)
    ├── status: launching | running | idle | closing | crashed
    │
    ├── runtime
    │   ├── browser_type: chromium | firefox
    │   ├── headless: true | false
    │   ├── cdp_endpoint: "ws://localhost:9222/..."
    │   ├── pid: 进程 ID
    │   ├── memory_mb: 内存占用
    │   ├── cpu_percent: CPU 占用
    │   └── pages_count: 打开标签页数
    │
    ├── automation
    │   ├── current_url
    │   ├── current_title
    │   └── last_action_at
    │
    └── created_at / closed_at
```

#### 4.2.9 任务队列模块 (Task Module) — Phase 3

AI Agent 提交浏览器自动化任务，系统异步执行。

```
TaskService
    │
    ├── submitTask()           → 提交自动化任务
    ├── batchSubmit()          → 批量提交任务
    ├── scheduleTask()         → 定时/延迟调度任务
    ├── runScript()            → 直接运行脚本（同步执行，实时返回）
    ├── getTaskStatus()        → 查询任务状态
    ├── cancelTask()           → 取消排队中的任务
    ├── listTasks()            → 列表查询
    ├── getTaskResult()        → 获取任务执行结果
    └── retryTask()            → 重试失败任务

TaskScheduler (内部调度器)
    │
    ├── enqueue()              → 入队
    ├── dequeue()              → 出队
    ├── prioritize()           → 优先级调整
    └── monitor()              → 队列监控
```

**任务数据模型**:

```
BrowserTask
    │
    ├── task_id (唯一标识)
    ├── agent_id
    ├── profile_id (使用哪个 Profile)
    ├── status: queued | running | completed
    │           | failed | cancelled
    ├── priority: low | normal | high | urgent
    │
    ├── task_definition
    │   ├── type: navigate | scrape | form_fill
    │   │         | screenshot | custom_script
    │   ├── target_url
    │   ├── steps: [
    │   │   { action, selector, value, wait_ms }
    │   │ ]
    │   ├── script (自定义 JS)
    │   ├── timeout_ms
    │   └── retry_count
    │
    ├── result
    │   ├── status_code
    │   ├── screenshots: [url]
    │   ├── extracted_data: {}
    │   ├── cookies: []
    │   ├── error_message
    │   └── duration_ms
    │
    └── created_at / started_at / completed_at
```

> **设计要点**: Task 模块解耦了"提交意图"和"实际执行"。
> AI Agent 只需描述"要做什么"，系统自动选择 Profile、
> 启动浏览器、注入指纹、执行任务、收集结果。
> 这是 Agent-First 设计理念的核心体现。

#### 4.2.10 反检测引擎 (Anti-Detection Engine) — Phase 3

```
AntiDetectEngine
    │
    ├── FingerprintInjector
    │   ├── injectCanvas()     → Canvas 指纹噪声注入
    │   ├── injectWebGL()      → WebGL 渲染器伪装
    │   ├── injectAudio()      → AudioContext 噪声
    │   ├── injectWebRTC()     → WebRTC IP 伪装/禁用
    │   ├── injectFonts()      → 字体列表伪装
    │   ├── injectPlugins()    → 插件列表伪装
    │   ├── injectClientHints() → Client Hints 伪装
    │   └── injectMisc()       → navigator 属性、屏幕、硬件
    │
    ├── ConsistencyValidator
    │   ├── validateTimezone()  → 时区与 IP 地理位置匹配
    │   ├── validateLanguage()  → 语言与地区匹配
    │   ├── validateGeo()       → Geolocation 与 IP 匹配
    │   ├── validateScreen()    → 屏幕参数与 OS 匹配
    │   └── validateAll()       → 全量一致性校验
    │
    ├── LeakDetector
    │   ├── checkWebRTCLeak()  → WebRTC 真实 IP 泄漏
    │   ├── checkDNSLeak()     → DNS 泄漏
    │   ├── checkCanvasLeak()  → Canvas 指纹唯一性
    │   └── checkTimezLeak()   → 时区不一致泄漏
    │
    └── TemplateDatabase
        ├── getRealFingerprint() → 获取真实设备指纹模板
        ├── importFingerprints() → 导入指纹模板库
        └── getPopularConfigs()  → 获取主流配置（热门 UA/OS 组合）
```

> **实现策略**: 指纹注入基于 Playwright 的
> `page.addInitScript()` 和 CDP (Chrome DevTools Protocol)
> 实现。在页面加载前注入脚本，覆盖 `navigator`、
> `HTMLCanvasElement`、`WebGLRenderingContext` 等 API，
> 确保指纹在任何检测时机都保持一致。

### 4.3 Backend Client 设计

Agent Layer 通过 HTTP 调用代理后端，封装为统一的 `BackendClient`：

```typescript
// 设计概念，非实际代码
class BackendClient {
  private baseUrl = 
    'http://surprising-rejoicing.railway.internal';
  private tokenCache: Map<string, CachedToken>;

  // 自动登录代理后端并缓存 Token
  async getBackendToken(
    username: string, password: string
  ): Promise<string>;

  // 统一请求方法，自动携带 Token 和重试
  async request<T>(
    method: string, 
    path: string, 
    data?: unknown
  ): Promise<T>;
}
```

**关键设计点**：

1. **Token 缓存**：代理后端的 JWT Token 自动获取和刷新
2. **请求重试**：网络异常自动重试（指数退避）
3. **超时控制**：每个请求设置合理超时
4. **错误映射**：将后端错误码映射为 Agent 友好的错误信息
5. **请求日志**：所有与后端的交互记录详细日志

---

## 5. 数据库设计

### 5.1 ER 图

```
┌───────────────────┐    ┌─────────────────────┐
│    agent_apps     │    │   agent_sessions     │
│───────────────────│    │─────────────────────│
│ id                │1──N│ id                  │
│ name              │────│ agent_id            │
│ api_key (UNIQUE)  │    │ session_type        │
│ api_secret_hash   │    │ status              │
│ backend_uid       │    │ proxy_*_enc         │
│ backend_user      │    │ identity_id ★       │
│ backend_pass_enc  │    │ identity_pool ★     │
│ balance_cache     │    │ risk_level ★        │
│ trial_balance ★   │    │ health_score ★      │
│ max_sessions ★    │    │ success_rate ★      │
│ auth_mode ★       │    │ consecutive_fail ★  │
│ status            │    │ rotation_policy     │
│ rate_limit        │    │ backend_order       │
│ permissions       │    │ usage_stats         │
│ created_at        │    │ expires_at          │
└──────┬────────────┘    └─────────┬───────────┘
       │                           │
       │ 1──N                      │ 1──N
       │    ┌──────────────────┐   │   ┌───────────────────┐
       ├────│ agent_api_logs   │   └───│ agent_telemetry ★ │
       │    │──────────────────│       │───────────────────│
       │    │ agent_id         │       │ session_id        │
       │    │ method / path    │       │ event_type        │
       │    │ status_code      │       │ status_code       │
       │    │ idempotency_key  │       │ risk_level        │
       │    │ created_at       │       │ block_probability │
       │    └──────────────────┘       │ latency_ms        │
       │                               │ created_at        │
       │ 1──N                          └───────────────────┘
       │    ┌──────────────────────┐
       ├────│ agent_usage_records  │
       │    │──────────────────────│
       │    │ agent_id / session_id│
       │    │ action / cost        │
       │    │ created_at           │
       │    └──────────────────────┘
       │
       │ 1──N  ┌────────────────────────────┐
       ├───────│ agent_idempotency_keys ★   │
       │       │────────────────────────────│
       │       │ agent_id + key (UNIQUE) ★  │
       │       │ response_body              │
       │       │ expires_at                 │
       │       └────────────────────────────┘
       │
       │ 1──N  ┌──────────────────┐
       └───────│ agent_events     │
               │──────────────────│
               │ agent_id         │
               │ session_id       │
               │ event_type       │
               │ payload          │
               │ created_at       │
               └──────────────────┘

★ = v1.1 新增字段/表
```

### 5.2 表结构详细设计

#### 5.2.1 agent_apps — Agent 应用表

```sql
CREATE TABLE agent_apps (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  api_key       VARCHAR(64) UNIQUE NOT NULL,
  -- api_secret: bcrypt 哈希存储
  api_secret_hash VARCHAR(256) NOT NULL,
  -- 映射到代理后端的用户
  backend_user_id   INTEGER,
  backend_username  VARCHAR(50),
  -- AES-256-GCM 加密存储后端密码
  backend_password_enc VARCHAR(256),
  -- Agent 本地状态
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  balance_cache DECIMAL(12,2) DEFAULT 0,
  -- 试用模式: 新注册赠送免费额度
  trial_balance DECIMAL(12,2) DEFAULT 5.00,
  is_trial      BOOLEAN DEFAULT TRUE,
  -- 权限和限制
  permissions   JSONB DEFAULT '["proxy:read",
    "proxy:write","session:manage",
    "billing:read"]'::jsonb,
  rate_limit_per_min  INTEGER DEFAULT 60,
  rate_limit_per_day  INTEGER DEFAULT 10000,
  -- Session 并发限制
  max_active_sessions INTEGER DEFAULT 100,
  -- 认证模式: api_key_only / jwt
  auth_mode     VARCHAR(20) DEFAULT 'api_key_only',
  -- 联系信息
  contact_email VARCHAR(200),
  webhook_url   VARCHAR(500),
  -- 元数据
  metadata      JSONB DEFAULT '{}'::jsonb,
  last_active_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_apps_api_key 
  ON agent_apps(api_key);
CREATE INDEX idx_agent_apps_status 
  ON agent_apps(status);
CREATE INDEX idx_agent_apps_backend_uid 
  ON agent_apps(backend_user_id);
```

#### 5.2.2 agent_sessions — 代理会话表

```sql
CREATE TABLE agent_sessions (
  id              SERIAL PRIMARY KEY,
  session_id      VARCHAR(36) UNIQUE NOT NULL,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id) ON DELETE CASCADE,
  -- 会话类型和状态
  session_type    VARCHAR(20) NOT NULL,
  status          VARCHAR(20) NOT NULL 
    DEFAULT 'creating',
  -- 代理配置（密码 AES-256-GCM 加密存储）
  proxy_host      VARCHAR(200),
  proxy_port      INTEGER,
  proxy_username  VARCHAR(100),
  proxy_password_enc VARCHAR(256),
  proxy_protocol  VARCHAR(10) DEFAULT 'socks5',
  -- 地域配置
  country_code    VARCHAR(10),
  city_code       VARCHAR(20),
  isp_type        VARCHAR(20),
  -- 身份抽象（Phase 2 智能调度使用）
  identity_id     VARCHAR(36),
  identity_pool   VARCHAR(50),
  -- 轮换策略
  rotation_mode   VARCHAR(20) DEFAULT 'fixed',
  rotation_interval_sec INTEGER DEFAULT 0,
  last_rotated_at TIMESTAMPTZ,
  last_rotate_reason VARCHAR(50),
  -- 底层资源关联
  backend_order_no    VARCHAR(50),
  backend_product_no  VARCHAR(50),
  backend_instance_id VARCHAR(50),
  -- 健康/风控指标（Telemetry 驱动）
  risk_level      VARCHAR(10) DEFAULT 'low',
  health_score    INTEGER DEFAULT 100,
  success_rate    DECIMAL(5,4) DEFAULT 1.0000,
  consecutive_failures INTEGER DEFAULT 0,
  last_error_type VARCHAR(50),
  total_events    INTEGER DEFAULT 0,
  -- 使用统计
  bytes_used      BIGINT DEFAULT 0,
  requests_count  INTEGER DEFAULT 0,
  -- 时间
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_agent 
  ON agent_sessions(agent_id);
CREATE INDEX idx_sessions_status 
  ON agent_sessions(status);
CREATE INDEX idx_sessions_sid 
  ON agent_sessions(session_id);
CREATE INDEX idx_sessions_expires 
  ON agent_sessions(expires_at);
CREATE INDEX idx_sessions_identity 
  ON agent_sessions(identity_id);
CREATE INDEX idx_sessions_risk 
  ON agent_sessions(risk_level);
```

#### 5.2.3 agent_api_logs — API 调用日志表

```sql
CREATE TABLE agent_api_logs (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INTEGER REFERENCES agent_apps(id),
  method          VARCHAR(10) NOT NULL,
  path            VARCHAR(500) NOT NULL,
  status_code     INTEGER,
  latency_ms      INTEGER,
  request_body    JSONB,
  response_summary TEXT,
  ip_address      VARCHAR(45),
  user_agent      VARCHAR(500),
  idempotency_key VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_agent 
  ON agent_api_logs(agent_id, created_at DESC);
CREATE INDEX idx_api_logs_created 
  ON agent_api_logs(created_at DESC);
-- 幂等键唯一索引，防止并发重复订单
CREATE UNIQUE INDEX idx_api_logs_idempotency 
  ON agent_api_logs(agent_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
```

#### 5.2.3b agent_idempotency_keys — 幂等键表

单独维护幂等键，保证写操作的幂等性：

```sql
CREATE TABLE agent_idempotency_keys (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id),
  idempotency_key VARCHAR(64) NOT NULL,
  request_path    VARCHAR(500) NOT NULL,
  response_status INTEGER,
  response_body   JSONB,
  expires_at      TIMESTAMPTZ NOT NULL 
    DEFAULT NOW() + INTERVAL '24 hours',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 核心：唯一约束防止并发重复
  CONSTRAINT uq_agent_idempotency 
    UNIQUE (agent_id, idempotency_key)
);

CREATE INDEX idx_idempotency_expires 
  ON agent_idempotency_keys(expires_at);
```

#### 5.2.4 agent_usage_records — 使用记录表

```sql
CREATE TABLE agent_usage_records (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id),
  session_id      VARCHAR(36),
  action          VARCHAR(50) NOT NULL,
  resource_type   VARCHAR(20),
  cost_amount     DECIMAL(12,4) DEFAULT 0,
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_agent 
  ON agent_usage_records(agent_id, created_at DESC);
CREATE INDEX idx_usage_session 
  ON agent_usage_records(session_id);
```

#### 5.2.5 agent_events — 事件表

```sql
CREATE TABLE agent_events (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INTEGER REFERENCES agent_apps(id),
  session_id      VARCHAR(36),
  event_type      VARCHAR(50) NOT NULL,
  payload         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_agent 
  ON agent_events(agent_id, created_at DESC);
CREATE INDEX idx_events_type 
  ON agent_events(event_type);
```

#### 5.2.6 agent_telemetry — 遥测上报表

Agent 上报的代理使用效果数据，是智能调度的数据基础：

```sql
CREATE TABLE agent_telemetry (
  id              BIGSERIAL PRIMARY KEY,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id),
  session_id      VARCHAR(36) NOT NULL,
  -- 事件类型
  event_type      VARCHAR(30) NOT NULL,
  -- http_error / captcha / timeout / block
  -- / success / rate_limit / custom
  status_code     INTEGER,
  target_host     VARCHAR(200),
  latency_ms      INTEGER,
  error_message   VARCHAR(500),
  -- 由上报推算的指标
  risk_level      VARCHAR(10),
  block_probability DECIMAL(5,4),
  -- 扩展
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_session 
  ON agent_telemetry(session_id, created_at DESC);
CREATE INDEX idx_telemetry_agent 
  ON agent_telemetry(agent_id, created_at DESC);
CREATE INDEX idx_telemetry_type 
  ON agent_telemetry(event_type);
-- 用于聚合分析
CREATE INDEX idx_telemetry_risk 
  ON agent_telemetry(risk_level, created_at DESC);
```

#### 5.2.7 browser_profiles — 浏览器配置表 (Phase 2)

```sql
CREATE TABLE browser_profiles (
  id              SERIAL PRIMARY KEY,
  profile_id      VARCHAR(36) UNIQUE NOT NULL,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id) ON DELETE CASCADE,
  -- 基础信息
  name            VARCHAR(200) NOT NULL,
  tags            TEXT[] DEFAULT '{}',
  group_id        INTEGER REFERENCES profile_groups(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  notes           TEXT,
  -- 代理绑定
  session_id      VARCHAR(36) 
    REFERENCES agent_sessions(session_id),
  proxy_url_cache VARCHAR(500),
  auto_match_proxy BOOLEAN DEFAULT TRUE,
  -- 运行统计
  launch_count    INTEGER DEFAULT 0,
  last_launched_at TIMESTAMPTZ,
  -- 时间
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_agent 
  ON browser_profiles(agent_id);
CREATE INDEX idx_profiles_status 
  ON browser_profiles(status);
CREATE INDEX idx_profiles_group 
  ON browser_profiles(group_id);
CREATE INDEX idx_profiles_session 
  ON browser_profiles(session_id);
CREATE INDEX idx_profiles_tags 
  ON browser_profiles USING GIN(tags);
```

#### 5.2.8 fingerprint_configs — 指纹配置表 (Phase 2)

独立存储指纹配置，便于复用和模板管理：

```sql
CREATE TABLE fingerprint_configs (
  id              SERIAL PRIMARY KEY,
  profile_id      VARCHAR(36) NOT NULL UNIQUE
    REFERENCES browser_profiles(profile_id) 
    ON DELETE CASCADE,
  -- 基础指纹
  os              VARCHAR(20) NOT NULL DEFAULT 'windows',
  browser         VARCHAR(20) NOT NULL DEFAULT 'chrome',
  browser_version VARCHAR(30),
  user_agent      TEXT NOT NULL,
  platform        VARCHAR(30),
  -- 屏幕参数
  screen_width    INTEGER DEFAULT 1920,
  screen_height   INTEGER DEFAULT 1080,
  screen_depth    INTEGER DEFAULT 24,
  device_pixel_ratio DECIMAL(3,1) DEFAULT 1.0,
  -- 硬件参数
  cpu_cores       INTEGER DEFAULT 8,
  memory_gb       INTEGER DEFAULT 8,
  gpu_vendor      VARCHAR(100),
  gpu_renderer    VARCHAR(200),
  max_touch_points INTEGER DEFAULT 0,
  -- Canvas 指纹
  canvas_mode     VARCHAR(10) DEFAULT 'noise',
  canvas_seed     VARCHAR(64),
  -- WebGL 指纹
  webgl_mode      VARCHAR(10) DEFAULT 'noise',
  webgl_vendor    VARCHAR(100),
  webgl_renderer  VARCHAR(200),
  webgl_unmasked_vendor VARCHAR(100),
  webgl_unmasked_renderer VARCHAR(200),
  webgl_seed      VARCHAR(64),
  -- Audio 指纹
  audio_mode      VARCHAR(10) DEFAULT 'noise',
  audio_seed      VARCHAR(64),
  -- WebRTC 控制
  webrtc_mode     VARCHAR(10) DEFAULT 'fake',
  webrtc_public_ip VARCHAR(45),
  webrtc_local_ips TEXT[],
  -- 地理与语言
  timezone        VARCHAR(50) DEFAULT 'America/New_York',
  locale          VARCHAR(20) DEFAULT 'en-US',
  languages       TEXT[] DEFAULT '{"en-US","en"}',
  geo_latitude    DECIMAL(10,7),
  geo_longitude   DECIMAL(10,7),
  geo_accuracy    INTEGER DEFAULT 100,
  -- 字体与插件
  fonts           JSONB DEFAULT '[]'::jsonb,
  plugins         JSONB DEFAULT '[]'::jsonb,
  -- Client Hints
  client_hints    JSONB DEFAULT '{}'::jsonb,
  -- 媒体设备
  media_devices   JSONB DEFAULT '{}'::jsonb,
  -- 杂项
  do_not_track    VARCHAR(5) DEFAULT 'null',
  battery         JSONB DEFAULT '{}'::jsonb,
  -- Cookie & Storage (加密存储)
  cookies_enc     TEXT,
  local_storage_enc TEXT,
  -- 扩展列表
  extensions      JSONB DEFAULT '[]'::jsonb,
  -- 时间
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fp_config_profile 
  ON fingerprint_configs(profile_id);
CREATE INDEX idx_fp_config_os_browser 
  ON fingerprint_configs(os, browser);
```

#### 5.2.9 profile_groups — 配置分组表 (Phase 2)

```sql
CREATE TABLE profile_groups (
  id              SERIAL PRIMARY KEY,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  color           VARCHAR(7),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_group_name 
    UNIQUE (agent_id, name)
);
```

#### 5.2.10 browser_instances — 浏览器实例表 (Phase 3)

```sql
CREATE TABLE browser_instances (
  id              SERIAL PRIMARY KEY,
  instance_id     VARCHAR(36) UNIQUE NOT NULL,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id),
  profile_id      VARCHAR(36) NOT NULL 
    REFERENCES browser_profiles(profile_id),
  -- 运行状态
  status          VARCHAR(20) NOT NULL 
    DEFAULT 'launching',
  browser_type    VARCHAR(20) DEFAULT 'chromium',
  headless        BOOLEAN DEFAULT TRUE,
  -- 运行时信息
  cdp_endpoint    VARCHAR(500),
  pid             INTEGER,
  memory_mb       INTEGER DEFAULT 0,
  cpu_percent     DECIMAL(5,2) DEFAULT 0,
  pages_count     INTEGER DEFAULT 1,
  current_url     VARCHAR(2000),
  current_title   VARCHAR(500),
  -- 时间
  last_action_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ
);

CREATE INDEX idx_instances_agent 
  ON browser_instances(agent_id);
CREATE INDEX idx_instances_profile 
  ON browser_instances(profile_id);
CREATE INDEX idx_instances_status 
  ON browser_instances(status);
```

#### 5.2.11 browser_tasks — 浏览器任务表 (Phase 3)

```sql
CREATE TABLE browser_tasks (
  id              SERIAL PRIMARY KEY,
  task_id         VARCHAR(36) UNIQUE NOT NULL,
  agent_id        INTEGER NOT NULL 
    REFERENCES agent_apps(id),
  profile_id      VARCHAR(36) NOT NULL 
    REFERENCES browser_profiles(profile_id),
  instance_id     VARCHAR(36) 
    REFERENCES browser_instances(instance_id),
  -- 任务定义
  task_type       VARCHAR(30) NOT NULL,
  priority        VARCHAR(10) DEFAULT 'normal',
  status          VARCHAR(20) NOT NULL DEFAULT 'queued',
  target_url      VARCHAR(2000),
  steps           JSONB DEFAULT '[]'::jsonb,
  script          TEXT,
  timeout_ms      INTEGER DEFAULT 60000,
  max_retries     INTEGER DEFAULT 1,
  retry_count     INTEGER DEFAULT 0,
  -- 执行结果
  result_status   INTEGER,
  result_data     JSONB DEFAULT '{}'::jsonb,
  screenshots     TEXT[] DEFAULT '{}',
  error_message   TEXT,
  duration_ms     INTEGER,
  -- 幂等键
  idempotency_key VARCHAR(64),
  -- 时间
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_tasks_agent 
  ON browser_tasks(agent_id);
CREATE INDEX idx_tasks_profile 
  ON browser_tasks(profile_id);
CREATE INDEX idx_tasks_status 
  ON browser_tasks(status, priority);
CREATE INDEX idx_tasks_instance 
  ON browser_tasks(instance_id);
CREATE UNIQUE INDEX idx_tasks_idempotency 
  ON browser_tasks(agent_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
```

#### 5.2.12 browser_cookies — Cookie 存储表 (Phase 3)

独立存储 Profile 的 Cookie，支持跨实例持久化：

```sql
CREATE TABLE browser_cookies (
  id              BIGSERIAL PRIMARY KEY,
  profile_id      VARCHAR(36) NOT NULL 
    REFERENCES browser_profiles(profile_id) 
    ON DELETE CASCADE,
  -- Cookie 数据（AES-256-GCM 加密）
  domain          VARCHAR(500) NOT NULL,
  cookies_enc     TEXT NOT NULL,
  -- 时间
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cookies_profile 
  ON browser_cookies(profile_id);
CREATE UNIQUE INDEX idx_cookies_domain 
  ON browser_cookies(profile_id, domain);
```

---

## 6. API 接口设计

### 6.0 通用规范

**Base URL**: `https://<agent-layer-domain>/v1`

**认证方式（二选一）**:

模式一 — 纯 API Key（推荐 AI Agent）：
```
X-API-Key: <api_key>
```

模式二 — JWT Token（控制台/高安全场景）：
```
Authorization: Bearer <jwt_token>
```

**Rate Limit 响应头**:  
所有响应包含以下头信息，429 时额外包含 `Retry-After`：
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708000000
Retry-After: 30           # 仅 429 时返回
```

**统一响应格式**:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "req_xxxx",
    "timestamp": "2026-02-15T10:00:00Z",
    "latency_ms": 120
  }
}
```

**错误响应格式**:
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
    "request_id": "req_xxxx",
    "timestamp": "2026-02-15T10:00:00Z"
  }
}
```

**幂等性**:  
所有 POST/PUT 请求支持 `Idempotency-Key` 请求头，相同 Key 的重复请求返回相同结果。

**分页**:
```json
{
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

### 6.1 认证 API

> **大多数 AI Agent 使用纯 API Key 模式即可**，
> 无需调用以下 Token 接口。
> 只需在每个请求头加 `X-API-Key: ak_xxx`。

#### POST /v1/auth/token （仅 JWT 模式需要）

获取 JWT 访问令牌。适用于控制台或高安全场景。

**请求**:
```json
{
  "api_key": "ak_xxxxxxxxxxxx",
  "api_secret": "sk_xxxxxxxxxxxx"
}
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
      "name": "My Agent App",
      "permissions": [
        "proxy:read", "proxy:write",
        "session:manage", "billing:read"
      ]
    }
  }
}
```

#### POST /v1/auth/refresh （仅 JWT 模式需要）

刷新访问令牌（使用当前有效 Token）。

---

### 6.2 账户管理 API

#### POST /v1/account/register

注册新的 Agent 账户。此接口会同时在代理后端创建对应用户。

**请求**:
```json
{
  "name": "My AI Agent",
  "contact_email": "agent@example.com",
  "webhook_url": "https://my-agent.com/webhook"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "agent_id": 1,
    "name": "My AI Agent",
    "api_key": "ak_xxxxxxxxxxxxxxxx",
    "api_secret": "sk_xxxxxxxxxxxxxxxx",
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

> ⚠️ `api_secret` 仅在注册时返回一次，请妥善保管。
> 
> 💡 新注册 Agent 默认获得 **¥5.00 试用额度**，
> 可立即创建 Session 体验，无需充值。

#### GET /v1/account/info

获取当前 Agent 账户信息。

**响应**:
```json
{
  "success": true,
  "data": {
    "agent_id": 1,
    "name": "My AI Agent",
    "status": "active",
    "balance": 1000.00,
    "total_sessions": 15,
    "active_sessions": 3,
    "permissions": ["proxy:read", "proxy:write",
      "session:manage", "billing:read"],
    "rate_limit": {
      "per_minute": 60,
      "per_day": 10000
    },
    "created_at": "2026-02-15T10:00:00Z",
    "last_active_at": "2026-02-15T12:30:00Z"
  }
}
```

#### PUT /v1/account/info

更新 Agent 账户信息。

#### POST /v1/account/rotate-secret

重新生成 API Secret。

---

### 6.3 余额与充值 API

#### GET /v1/billing/balance

查询当前余额。

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

#### POST /v1/billing/recharge

创建充值订单。

**请求**:
```json
{
  "amount": 500.00,
  "payment_method": "usdt",
  "currency": "CNY"
}
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

#### GET /v1/billing/recharge/:order_id/status

查询充值订单状态。

#### GET /v1/billing/transactions

查询交易记录。

**Query 参数**:
- `page`: 页码
- `page_size`: 每页数量
- `type`: 交易类型（recharge / consume / refund）
- `start_date` / `end_date`: 日期范围

#### GET /v1/billing/usage-report

获取使用报告。

**Query 参数**:
- `period`: day / week / month
- `start_date` / `end_date`: 日期范围

---

### 6.4 代理产品 API

#### GET /v1/products

获取可用代理产品列表。

**Query 参数**:
- `type`: static / dynamic
- `country`: 国家代码
- `city`: 城市代码

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "product_no": "out_dynamic_1",
        "name": "动态IP池1",
        "type": "dynamic",
        "description": "全球动态住宅IP",
        "protocol": ["socks5", "http"],
        "pricing": {
          "unit": "GB",
          "price_per_unit": 10.00,
          "currency": "CNY",
          "min_purchase": 1
        },
        "features": [
          "全球覆盖",
          "自动轮换",
          "高匿名"
        ],
        "available_regions": ["US", "UK", "JP"],
        "stock": "available"
      },
      {
        "product_no": "LM_US_01",
        "name": "美国静态住宅IP",
        "type": "static",
        "description": "美国洛杉矶静态住宅IP",
        "protocol": ["socks5", "http"],
        "pricing": {
          "unit": "IP/月",
          "price_per_unit": 50.00,
          "currency": "CNY",
          "min_purchase": 1,
          "duration_options": [
            { "days": 30, "label": "1个月" },
            { "days": 90, "label": "3个月" }
          ]
        },
        "location": {
          "country": "US",
          "country_name": "美国",
          "city": "Los Angeles"
        },
        "stock": 156
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 50
    }
  }
}
```

#### GET /v1/products/:product_no

获取单个产品详情。

#### GET /v1/products/regions

获取可用地域列表。

**响应**:
```json
{
  "success": true,
  "data": {
    "regions": [
      {
        "area_code": "NA",
        "area_name": "北美洲",
        "countries": [
          {
            "code": "US",
            "name": "美国",
            "cities": [
              { "code": "LA", "name": "洛杉矶" },
              { "code": "NY", "name": "纽约" }
            ]
          }
        ]
      }
    ]
  }
}
```

#### POST /v1/products/recommend

AI 推荐接口 — 根据需求推荐最佳代理配置。

**请求**:
```json
{
  "use_case": "web_scraping",
  "target_region": "US",
  "budget": 100.00,
  "session_count": 5,
  "duration_days": 30,
  "require_sticky_ip": false,
  "protocol_preference": "http"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "rank": 1,
        "product_no": "out_dynamic_1",
        "name": "动态IP池1",
        "reason": "适合大量爬取，自动轮换避免封禁",
        "estimated_cost": 80.00,
        "score": 0.95
      },
      {
        "rank": 2,
        "product_no": "dynamic_ipweb",
        "name": "动态IP池3-IPWEB",
        "reason": "全球覆盖，性价比高",
        "estimated_cost": 60.00,
        "score": 0.88
      }
    ]
  }
}
```

---

### 6.5 Session 管理 API（核心）

#### POST /v1/sessions

创建代理会话。

**请求 — 动态代理**:
```json
{
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
  },
  "idempotency_key": "create_sess_20260215_001"
}
```

**请求 — 静态代理**:
```json
{
  "type": "static",
  "config": {
    "product_no": "LM_US_01",
    "quantity": 2,
    "duration_days": 30,
    "country": "US",
    "city": "LA"
  },
  "idempotency_key": "create_sess_20260215_002"
}
```

**响应**（异步创建，初始状态 `creating`）:
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

**轮询状态**（当 status 变为 `active` 时获取完整信息）:
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

> **异步创建设计**：
> 后端代理开通可能耗时较长（特别是静态代理）。
> 创建 API 立即返回 `creating` 状态，后台异步完成。
> Agent 通过轮询 `GET /v1/sessions/:id` 或配置
> Webhook 获取完成通知。避免同步阻塞导致雪崩。

#### GET /v1/sessions

获取会话列表。

**Query 参数**:
- `status`: active / expired / error / all
- `type`: static / dynamic
- `page` / `page_size`

#### GET /v1/sessions/:session_id

获取会话详情。

#### POST /v1/sessions/:session_id/rotate

轮换代理 IP（仅动态代理）。

**请求**（可选 body）:
```json
{
  "reason": "http_403"
}
```

**reason 可选值**:

| 值 | 说明 |
|------|------|
| `http_403` | 目标返回 403 Forbidden |
| `http_429` | 目标返回 429 Too Many Requests |
| `captcha` | 触发验证码 |
| `timeout` | 连接超时 |
| `block` | IP 被封禁 |
| `scheduled` | 定时轮换 |
| `manual` | 手动轮换（默认） |

> 上报 reason 有助于系统收集风控数据，
> 未来驱动智能调度。

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
      "username": "user_abc123_new",
      "password": "pass_new789",
      "protocol": "socks5",
      "full_url": "socks5://user_abc123_new:pass_new789@proxy.example.com:10002"
    },
    "rotated_at": "2026-02-15T10:05:00Z"
  }
}
```

#### POST /v1/sessions/:session_id/renew

续费会话。

**请求**:
```json
{
  "duration_days": 30,
  "idempotency_key": "renew_sess_20260215_001"
}
```

#### POST /v1/sessions/:session_id/terminate

终止/释放会话。

#### GET /v1/sessions/:session_id/usage

查询会话使用量。

**响应**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_a1b2c3d4-e5f6-7890",
    "traffic": {
      "total_gb": 10,
      "used_gb": 3.5,
      "remaining_gb": 6.5,
      "usage_percentage": 35.0
    },
    "requests": {
      "total": 15000,
      "today": 500
    },
    "cost": {
      "total": 35.00,
      "today": 5.00,
      "currency": "CNY"
    },
    "period": {
      "start": "2026-02-15T10:00:00Z",
      "end": "2026-03-15T10:00:00Z"
    }
  }
}
```

#### POST /v1/sessions/:session_id/whitelist

管理 IP 白名单。

**请求**:
```json
{
  "action": "add",
  "ips": ["203.0.113.1", "198.51.100.0/24"]
}
```

---

### 6.6 遥测上报 API（Telemetry）

**这是系统的核心差异化能力**。Agent 通过上报代理使用效果，
系统更新 Session 健康指标，未来驱动智能调度。

#### POST /v1/sessions/:session_id/report-event

上报 Session 使用事件。

**请求**:
```json
{
  "event_type": "http_error",
  "status_code": 403,
  "target_host": "example.com",
  "latency_ms": 2500,
  "error_message": "Forbidden",
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "request_path": "/api/data"
  }
}
```

**event_type 可选值**:

| 值 | 说明 |
|------|------|
| `success` | 请求成功 |
| `http_error` | HTTP 错误（含 status_code） |
| `captcha` | 触发验证码 |
| `timeout` | 连接/请求超时 |
| `block` | IP 被封禁 |
| `rate_limit` | 触发目标网站限流 |
| `custom` | 自定义事件 |

**响应**:
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

> **recommendation 值说明**:
> - `ok` — 状态良好，无需操作
> - `consider_rotate` — 建议轮换 IP
> - `rotate_now` — 强烈建议立即轮换
> - `pause` — 建议暂停使用，等待冷却

#### POST /v1/telemetry/batch

批量上报事件（减少网络开销）。

**请求**:
```json
{
  "events": [
    {
      "session_id": "sess_xxx",
      "event_type": "success",
      "latency_ms": 200
    },
    {
      "session_id": "sess_xxx",
      "event_type": "http_error",
      "status_code": 429,
      "latency_ms": 150
    }
  ]
}
```

#### GET /v1/sessions/:session_id/health

获取 Session 健康指标。

**响应**:
```json
{
  "success": true,
  "data": {
    "session_id": "sess_xxx",
    "risk_level": "low",
    "health_score": 95,
    "success_rate": 0.97,
    "consecutive_failures": 0,
    "last_error_type": null,
    "total_events": 150,
    "block_probability": 0.03,
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

---

### 6.7 查询与统计 API

#### GET /v1/stats/overview

获取概览统计。

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

#### GET /v1/stats/traffic

获取流量统计。

**Query 参数**:
- `granularity`: hour / day / week
- `start_date` / `end_date`

#### GET /v1/stats/cost

获取费用统计。

---

### 6.8 事件与 Webhook API

#### GET /v1/events

获取事件列表。

**Query 参数**:
- `type`: session.created / session.expired / balance.low 等
- `page` / `page_size`

#### POST /v1/webhook/test

测试 Webhook 连通性。

**Webhook 事件类型**:

| 事件类型 | 说明 |
|---------|------|
| `session.created` | 会话创建成功 |
| `session.expired` | 会话到期 |
| `session.error` | 会话异常 |
| `session.rotated` | 代理已轮换 |
| `balance.low` | 余额不足预警 |
| `recharge.completed` | 充值完成 |
| `traffic.threshold` | 流量使用达到阈值 |

---

### 6.9 系统 API

#### GET /v1/health

健康检查。

#### GET /v1/ping

连通性测试。

---

### 6.10 指纹配置 API (Phase 2)

#### POST /v1/profiles

创建浏览器配置。

**请求**:
```json
{
  "name": "US Chrome Profile",
  "group": "us-accounts",
  "tags": ["production", "ecommerce"],
  "fingerprint": {
    "os": "windows",
    "browser": "chrome",
    "browser_version": "120",
    "screen": { "width": 1920, "height": 1080 },
    "hardware": { "cpu_cores": 8, "memory_gb": 16 },
    "canvas": { "mode": "noise" },
    "webgl": { "mode": "noise" },
    "audio": { "mode": "noise" },
    "webrtc": { "mode": "fake" },
    "location": {
      "timezone": "America/New_York",
      "locale": "en-US",
      "languages": ["en-US", "en"]
    }
  },
  "proxy_binding": {
    "session_id": "sess_xxx",
    "auto_match": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "profile_id": "prof_a1b2c3d4",
    "name": "US Chrome Profile",
    "status": "active",
    "fingerprint": {
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
      "os": "windows",
      "browser": "chrome",
      "browser_version": "120.0.6099.109",
      "screen": { "width": 1920, "height": 1080 },
      "canvas_hash": "a1b2c3...",
      "webgl_hash": "d4e5f6...",
      "audio_hash": "g7h8i9..."
    },
    "proxy_binding": {
      "session_id": "sess_xxx",
      "proxy_url": "socks5://user:pass@proxy:port"
    },
    "created_at": "2026-03-08T10:00:00Z"
  }
}
```

> 指纹参数可部分指定，未指定的参数由系统基于
> OS/Browser 组合智能随机生成，确保内部一致性。

#### GET /v1/profiles

获取配置列表。

**Query 参数**:
- `status`: active / archived / all
- `group`: 分组名
- `tags`: 标签过滤（逗号分隔）
- `search`: 名称模糊搜索
- `page` / `page_size`

#### GET /v1/profiles/:profile_id

获取配置详情（含完整指纹参数）。

#### PUT /v1/profiles/:profile_id

更新配置。支持部分更新。

#### DELETE /v1/profiles/:profile_id

删除配置（关联的浏览器实例会被终止）。

#### POST /v1/profiles/:profile_id/duplicate

克隆配置（指纹自动重新随机化）。

**请求**:
```json
{
  "new_name": "US Chrome Profile - Copy",
  "regenerate_fingerprint": true
}
```

#### POST /v1/profiles/batch-create

批量创建配置。

**请求**:
```json
{
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
}
```

#### POST /v1/profiles/import

导入配置。

**请求** (multipart/form-data):
- `file`: JSON/CSV 文件
- `format`: json / csv

#### GET /v1/profiles/export

导出配置。

**Query 参数**:
- `profile_ids`: 指定导出的配置 ID（逗号分隔）
- `format`: json / csv

#### POST /v1/profiles/:profile_id/bind-proxy

绑定代理到配置。

**请求**:
```json
{
  "session_id": "sess_xxx",
  "auto_match": false
}
```

#### DELETE /v1/profiles/:profile_id/bind-proxy

解除代理绑定。

---

### 6.11 指纹生成 API (Phase 2)

#### POST /v1/fingerprints/generate

生成随机指纹配置。

**请求**:
```json
{
  "os": "windows",
  "browser": "chrome",
  "browser_version": "120",
  "country": "US"
}
```

**响应**: 完整的指纹参数集合（与 Profile 创建
时的 `fingerprint` 字段结构一致）。

#### GET /v1/fingerprints/templates

获取指纹模板列表（基于真实设备采集的指纹模板）。

**Query 参数**:
- `os`: 操作系统筛选
- `browser`: 浏览器筛选
- `popularity`: popular / all

#### POST /v1/fingerprints/validate

验证指纹参数一致性。

**请求**:
```json
{
  "fingerprint": { ... },
  "proxy_country": "US"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": [],
    "consistency_score": 98,
    "details": {
      "timezone_match": true,
      "language_match": true,
      "geo_match": true,
      "screen_os_match": true,
      "ua_version_match": true
    }
  }
}
```

---

### 6.12 配置分组 API (Phase 2)

#### POST /v1/profile-groups

创建分组。

#### GET /v1/profile-groups

获取分组列表。

#### PUT /v1/profile-groups/:id

更新分组。

#### DELETE /v1/profile-groups/:id

删除分组。

---

### 6.13 浏览器实例 API (Phase 3)

#### POST /v1/browser/launch

启动浏览器实例。

**请求**:
```json
{
  "profile_id": "prof_xxx",
  "headless": true,
  "options": {
    "start_url": "https://example.com",
    "viewport": { "width": 1920, "height": 1080 },
    "timeout_ms": 30000
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "instance_id": "inst_a1b2c3d4",
    "profile_id": "prof_xxx",
    "status": "running",
    "browser_type": "chromium",
    "headless": true,
    "cdp_endpoint": "ws://...",
    "proxy": {
      "host": "proxy.example.com",
      "port": 10001
    },
    "fingerprint_summary": {
      "user_agent": "Mozilla/5.0 ...",
      "os": "windows",
      "browser": "chrome 120",
      "screen": "1920x1080"
    },
    "created_at": "2026-03-08T10:00:00Z"
  }
}
```

#### GET /v1/browser/instances

获取运行中的实例列表。

#### GET /v1/browser/instances/:instance_id

获取实例详情。

#### POST /v1/browser/instances/:instance_id/close

关闭浏览器实例。

**请求**:
```json
{
  "save_cookies": true,
  "save_storage": true
}
```

#### POST /v1/browser/batch-launch

批量启动浏览器。

**请求**:
```json
{
  "profile_ids": ["prof_1", "prof_2", "prof_3"],
  "headless": true,
  "start_url": "https://example.com"
}
```

#### POST /v1/browser/batch-close

批量关闭浏览器。

---

### 6.14 浏览器自动化 API (Phase 3)

#### POST /v1/browser/instances/:instance_id/navigate

导航到 URL。

**请求**:
```json
{
  "url": "https://example.com",
  "wait_until": "networkidle",
  "timeout_ms": 30000
}
```

#### POST /v1/browser/instances/:instance_id/execute

执行自动化动作序列。

**支持的 action type 完整列表**:

| type | 参数 | 说明 | Playwright 映射 |
|------|------|------|----------------|
| `click` | selector, button?, modifiers? | 点击元素 | `locator.click()` |
| `fill` | selector, value | 清空并填充 | `locator.fill()` |
| `type` | selector, text, delay? | 逐字输入 | `locator.type()` |
| `hover` | selector | 悬停 | `locator.hover()` |
| `select` | selector, value/values | 下拉选择 | `locator.selectOption()` |
| `scroll` | selector?, x?, y?, direction? | 滚动 | `mouse.wheel / scrollIntoView` |
| `press` | key, modifiers? | 按键 | `keyboard.press()` |
| `keyboard` | action(down/up/type), key/text | 键盘组合键 | `keyboard.down/up/type` |
| `mouse` | action(click/move/down/up), x, y | 坐标操作 | `mouse.click/move` |
| `drag` | source, target | 拖拽 | `page.dragAndDrop()` |
| `upload_file` | selector, file_path/file_url | 上传文件 | `setInputFiles()` |
| `download_file` | trigger_selector?, url? | 下载文件 | `waitForEvent('download')` |
| `wait` | ms | 等待固定时间 | `page.waitForTimeout()` |
| `wait_for` | selector?, state?, timeout_ms? | 等待元素/条件 | `locator.waitFor()` |
| `evaluate` | script, args? | 执行 JS | `page.evaluate()` |
| `screenshot` | selector?, full_page? | 截图 | `page.screenshot()` |
| `intercept_request` | url_pattern, action(block/modify/continue), headers?, body? | 拦截请求 | `page.route()` |
| `intercept_response` | url_pattern, body?, status? | 修改响应 | `page.route() + fulfill` |
| `network_monitor` | action(start/stop), url_pattern? | 网络监控 | HAR recording |

**请求示例**:
```json
{
  "actions": [
    { "type": "intercept_request",
      "url_pattern": "**/*.{png,jpg}",
      "action": "block" },
    { "type": "click", "selector": "#login-btn" },
    { "type": "wait", "ms": 1000 },
    { "type": "fill", "selector": "#username", 
      "value": "user01" },
    { "type": "fill", "selector": "#password", 
      "value": "pass123" },
    { "type": "keyboard", "action": "type",
      "text": "Enter" },
    { "type": "wait_for", "selector": ".dashboard",
      "timeout_ms": 5000 },
    { "type": "hover", "selector": ".user-menu" },
    { "type": "screenshot" }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "results": [
      { "step": 1, "status": "ok", "duration_ms": 50 },
      { "step": 2, "status": "ok", "duration_ms": 1000 },
      { "step": 3, "status": "ok", "duration_ms": 30 },
      { "step": 4, "status": "ok", "duration_ms": 25 },
      { "step": 5, "status": "ok", "duration_ms": 45 },
      { "step": 6, "status": "ok", "duration_ms": 2100 }
    ],
    "current_url": "https://example.com/dashboard",
    "total_duration_ms": 3250
  }
}
```

#### POST /v1/browser/instances/:instance_id/network-monitor

启动/停止网络活动监控（HAR 录制）。

**请求**:
```json
{
  "action": "start",
  "url_pattern": "**api/**",
  "capture_headers": true,
  "capture_body": true
}
```

**响应**（stop 时返回录制数据）:
```json
{
  "success": true,
  "data": {
    "requests_count": 42,
    "total_bytes": 125000,
    "har_url": "https://storage.xxx/har-xxx.json",
    "entries": [
      { "url": "https://api.example.com/data",
        "method": "GET",
        "status": 200,
        "duration_ms": 120,
        "size_bytes": 4500 }
    ]
  }
}
```

#### POST /v1/browser/instances/:instance_id/evaluate

执行 JavaScript 脚本。

**请求**:
```json
{
  "script": "return document.title;",
  "timeout_ms": 5000
}
```

#### POST /v1/browser/instances/:instance_id/screenshot

截图。

**请求**:
```json
{
  "type": "full_page",
  "format": "png",
  "quality": 80
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "screenshot_url": "https://storage.xxx/screenshot.png",
    "width": 1920,
    "height": 4500,
    "size_bytes": 125000
  }
}
```

#### GET /v1/browser/instances/:instance_id/cookies

获取当前 Cookie。

#### POST /v1/browser/instances/:instance_id/cookies

设置 Cookie。

---

### 6.15 浏览器任务 API (Phase 3)

#### POST /v1/tasks

提交浏览器自动化任务（异步执行）。

**请求**:
```json
{
  "profile_id": "prof_xxx",
  "task_type": "scrape",
  "target_url": "https://example.com/data",
  "steps": [
    { "action": "navigate", "url": "https://example.com/data" },
    { "action": "wait_for", "selector": ".data-table" },
    { "action": "evaluate",
      "script": "return [...document.querySelectorAll('.data-table tr')].map(r => r.textContent)" },
    { "action": "screenshot" }
  ],
  "timeout_ms": 60000,
  "priority": "normal",
  "idempotency_key": "task_scrape_001"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "task_id": "task_a1b2c3d4",
    "status": "queued",
    "position_in_queue": 3,
    "estimated_start": "2026-03-08T10:00:30Z"
  }
}
```

#### GET /v1/tasks/:task_id

获取任务状态和结果。

**响应**（完成时）:
```json
{
  "success": true,
  "data": {
    "task_id": "task_a1b2c3d4",
    "status": "completed",
    "profile_id": "prof_xxx",
    "result": {
      "extracted_data": [...],
      "screenshots": ["https://storage.xxx/s1.png"],
      "cookies_saved": true,
      "duration_ms": 8500
    },
    "created_at": "2026-03-08T10:00:00Z",
    "completed_at": "2026-03-08T10:00:08Z"
  }
}
```

#### GET /v1/tasks

获取任务列表。

**Query 参数**:
- `status`: queued / running / completed / failed / all
- `profile_id`: 按配置筛选
- `page` / `page_size`

#### DELETE /v1/tasks/:task_id

取消排队中的任务。

#### POST /v1/tasks/:task_id/retry

重试失败的任务。

#### POST /v1/tasks/batch

批量提交任务。

**请求**:
```json
{
  "tasks": [
    {
      "profile_id": "prof_1",
      "task_type": "screenshot",
      "target_url": "https://site-a.com"
    },
    {
      "profile_id": "prof_2",
      "task_type": "screenshot",
      "target_url": "https://site-b.com"
    }
  ],
  "priority": "normal"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "submitted_count": 2,
    "task_ids": ["task_a1", "task_a2"]
  }
}
```

#### POST /v1/tasks/schedule

定时/延迟调度任务。

**请求**:
```json
{
  "profile_id": "prof_xxx",
  "task_type": "scrape",
  "target_url": "https://example.com/data",
  "schedule": {
    "type": "delay",
    "delay_seconds": 3600
  },
  "steps": [
    { "action": "navigate", "url": "https://example.com/data" },
    { "action": "screenshot" }
  ]
}
```

#### POST /v1/browser/instances/:instance_id/run-script

直接运行脚本（同步执行，实时返回结果）。

**请求**:
```json
{
  "script": "const rows = document.querySelectorAll('tr'); return Array.from(rows).map(r => r.textContent);",
  "timeout_ms": 10000
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "result": ["row1 content", "row2 content"],
    "duration_ms": 150
  }
}
```

---

### 6.18 代理管理 API (Phase 2)

管理外部代理（非平台内置代理），供 Profile 绑定使用。

#### POST /v1/proxies

添加外部代理。

**请求**:
```json
{
  "name": "US Residential 01",
  "type": "socks5",
  "host": "1.2.3.4",
  "port": 1080,
  "username": "user",
  "password": "pass",
  "country": "US",
  "city": "Los Angeles",
  "tags": ["residential", "us"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "proxy_id": "prx_a1b2c3",
    "status": "untested",
    "full_url": "socks5://user:pass@1.2.3.4:1080"
  }
}
```

#### POST /v1/proxies/import

批量导入代理。

**请求**:
```json
{
  "format": "text",
  "proxies": [
    "socks5://user:pass@1.2.3.4:1080",
    "http://user:pass@5.6.7.8:8080"
  ],
  "auto_verify": true,
  "tags": ["imported"]
}
```

#### GET /v1/proxies

获取代理列表。

**Query 参数**:
- `status`: active / failed / untested / all
- `country`: 按国家筛选
- `type`: socks5 / http / https
- `tags`: 按标签筛选
- `page` / `page_size`

#### POST /v1/proxies/:proxy_id/verify

测试代理连通性和匿名性。

**响应**:
```json
{
  "success": true,
  "data": {
    "proxy_id": "prx_a1b2c3",
    "status": "active",
    "latency_ms": 120,
    "detected_country": "US",
    "detected_city": "Los Angeles",
    "anonymity": "elite",
    "tested_at": "2026-03-08T10:00:00Z"
  }
}
```

#### POST /v1/proxies/:proxy_id/rotate

为绑定此代理的 Profile 轮换到新代理。

#### DELETE /v1/proxies/:proxy_id

删除代理。

---

### 6.19 Profile 导入导出 API (Phase 2)

#### POST /v1/profiles/import

从 JSON 批量导入配置。

**请求**:
```json
{
  "format": "json",
  "profiles": [
    {
      "name": "US Chrome Profile",
      "fingerprint": { "os": "windows", "browser": "chrome" },
      "proxy": "socks5://user:pass@1.2.3.4:1080",
      "cookies": [...]
    }
  ],
  "auto_generate_fingerprint": true
}
```

#### GET /v1/profiles/export

导出配置。

**Query 参数**:
- `profile_ids`: 指定导出哪些配置（逗号分隔）
- `group`: 按分组导出
- `include_cookies`: 是否含 Cookie 数据（默认 false）
- `include_storage`: 是否含 LocalStorage（默认 false）
- `format`: json（默认）

---

### 6.16 反检测 API (Phase 3)

#### POST /v1/anti-detect/test

对指纹配置运行检测测试。

**请求**:
```json
{
  "profile_id": "prof_xxx",
  "test_sites": [
    "pixelscan", "browserleaks", "creepjs"
  ]
}
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
    "warnings": [
      "WebGL renderer 与 GPU 型号不完全匹配"
    ],
    "leaked_info": []
  }
}
```

#### POST /v1/anti-detect/check-leaks

检查指纹泄漏。

**请求**:
```json
{
  "instance_id": "inst_xxx"
}
```

---

### 6.17 MCP Server API (Phase 3)

提供 Model Context Protocol 接口，AI Agent 可通过
MCP 工具定义直接操作指纹浏览器。

#### GET /v1/mcp/tools

获取可用的 MCP 工具列表。

**响应**:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "create_browser_profile",
        "description": "创建浏览器指纹配置",
        "parameters": { ... }
      },
      {
        "name": "launch_browser",
        "description": "启动浏览器实例",
        "parameters": { ... }
      },
      {
        "name": "navigate_to",
        "description": "浏览器导航到 URL",
        "parameters": { ... }
      },
      {
        "name": "execute_browser_task",
        "description": "提交浏览器自动化任务",
        "parameters": { ... }
      }
    ]
  }
}
```

#### POST /v1/mcp/execute

执行 MCP 工具调用。

**请求**:
```json
{
  "tool": "launch_browser",
  "arguments": {
    "profile_id": "prof_xxx",
    "headless": true,
    "start_url": "https://example.com"
  }
}
```

---

## 7. 核心业务流程

### 7.1 Agent 注册流程

```
Agent              Agent Layer              代理后端
  │                    │                       │
  │ POST /register     │                       │
  ├───────────────────►│                       │
  │                    │ 生成 api_key/secret    │
  │                    │ 生成后端用户名/密码     │
  │                    │                       │
  │                    │ POST /api/open/app/    │
  │                    │   user/create/v2       │
  │                    ├──────────────────────►│
  │                    │                       │ 创建用户
  │                    │◄──────────────────────┤
  │                    │                       │
  │                    │ POST /api/auth/login   │
  │                    ├──────────────────────►│
  │                    │                       │ 返回Token
  │                    │◄──────────────────────┤
  │                    │                       │
  │                    │ 缓存 backend token     │
  │                    │ 保存映射关系            │
  │                    │                       │
  │ 返回 api_key       │                       │
  │◄───────────────────┤                       │
```

### 7.2 创建动态代理会话流程（异步）

```
Agent              Agent Layer              代理后端
  │                    │                       │
  │ POST /sessions     │                       │
  │ type: dynamic      │                       │
  ├───────────────────►│                       │
  │                    │ 验证 API Key + 权限    │
  │                    │ 检查余额               │
  │                    │ 检查幂等键 (UNIQUE)     │
  │                    │ 创建 Session(creating)  │
  │                    │                       │
  │ 返回 session_id    │                       │
  │ status: creating   │                       │
  │◄───────────────────┤                       │
  │                    │                       │
  │                    │ [后台异步]              │
  │                    │ POST /api/business/    │
  │                    │ dynamic-proxy/open     │
  │                    ├──────────────────────►│
  │                    │                       │ 开通动态代理
  │                    │◄──────────────────────┤
  │                    │ 更新 Session → active  │
  │                    │ 记录使用日志            │
  │                    │ 触发 Webhook 通知      │
  │                    │                       │
  │ GET /sessions/:id  │                       │
  │ (轮询或Webhook)    │                       │
  ├───────────────────►│                       │
  │ 返回 active +      │                       │
  │ proxy 连接信息      │                       │
  │◄───────────────────┤                       │
```

> **为什么异步？** 后端 API 可能耗时较长，
> 同步阻塞在高并发下容易雪崩。
> 异步模式让 API 立即响应，后台完成后通知。

### 7.3 创建静态代理会话流程（异步）

```
Agent              Agent Layer              代理后端
  │                    │                       │
  │ POST /sessions     │                       │
  │ type: static       │                       │
  ├───────────────────►│                       │
  │                    │ 验证 API Key + 权限    │
  │                    │ 检查余额               │
  │                    │ 创建 Session(creating)  │
  │                    │                       │
  │ 返回 session_id    │                       │
  │ status: creating   │                       │
  │◄───────────────────┤                       │
  │                    │                       │
  │                    │ [后台异步]              │
  │                    │ 查询产品可用性          │
  │                    │ POST /api/open/app/    │
  │                    │ static/order/create/v2 │
  │                    ├──────────────────────►│
  │                    │                       │ 创建静态订单
  │                    │◄──────────────────────┤
  │                    │                       │
  │                    │ 轮询订单状态            │
  │                    │ GET /api/open/app/     │
  │                    │ static/order/list/v2   │
  │                    ├──────────────────────►│
  │                    │◄──────────────────────┤
  │                    │ 更新 Session → active  │
  │                    │ 填充 proxy 信息        │
  │                    │ 触发 Webhook 通知      │
  │                    │                       │
  │ GET /sessions/:id  │                       │
  │ (轮询或Webhook)    │                       │
  ├───────────────────►│                       │
  │ 返回 active +      │                       │
  │ proxy 连接信息      │                       │
  │◄───────────────────┤                       │
```

### 7.4 代理轮换流程

```
Agent              Agent Layer              代理后端
  │                    │                       │
  │ POST /sessions/    │                       │
  │ {id}/rotate        │                       │
  │ reason: "http_403" │                       │
  ├───────────────────►│                       │
  │                    │ 验证 Session 归属      │
  │                    │ 检查 Session 类型      │
  │                    │ (仅动态代理可轮换)      │
  │                    │ 记录轮换原因到 telemetry│
  │                    │                       │
  │                    │ POST /api/open/app/    │
  │                    │ proxy/refresh/v2/{no}  │
  │                    ├──────────────────────►│
  │                    │                       │ 刷新代理
  │                    │◄──────────────────────┤
  │                    │                       │
  │                    │ 更新 Session 信息      │
  │                    │ 更新健康指标            │
  │                    │ 记录轮换事件            │
  │                    │                       │
  │ 返回新 proxy 信息   │                       │
  │◄───────────────────┤                       │
```

### 7.5 充值流程

```
Agent              Agent Layer              代理后端
  │                    │                       │
  │ POST /billing/     │                       │
  │ recharge           │                       │
  ├───────────────────►│                       │
  │                    │                       │
  │                    │ POST /api/usdt/       │
  │                    │ create-order           │
  │                    ├──────────────────────►│
  │                    │◄──────────────────────┤
  │                    │                       │
  │ 返回支付信息        │                       │
  │◄───────────────────┤                       │
  │                    │                       │
  │  ... Agent 完成支付 ...                     │
  │                    │                       │
  │ GET /billing/      │                       │
  │ recharge/{id}/     │                       │
  │ status             │                       │
  ├───────────────────►│                       │
  │                    │ GET /api/usdt/        │
  │                    │ check-status           │
  │                    ├──────────────────────►│
  │                    │◄──────────────────────┤
  │                    │                       │
  │                    │ 更新本地余额缓存       │
  │                    │                       │
  │ 返回充值状态        │                       │
  │◄───────────────────┤                       │
```

---

## 8. 安全设计

### 8.1 认证机制

```
模式一（推荐 AI Agent）：
  API Key Header → 直接鉴权
  X-API-Key: ak_xxxxxxxx
  
  优点: 零维护成本，无 token refresh
  安全性: Railway HTTPS 保护传输层

模式二（控制台/高安全场景）：
  Layer 1: API Key + Secret → 获取 Token
  Layer 2: JWT Bearer Token → 用于请求
           有效期: 1 小时，支持刷新

未来扩展：
  Layer 3: 请求签名 (HMAC-SHA256)
           防止中间人攻击
```

> **设计决策**：AI Agent 最怕复杂的 token 
> refresh 流程。纯 API Key 模式下，Agent 只需
> 配一个环境变量即可永久使用，无任何运维负担。
> HTTPS 已提供足够的传输安全性。

### 8.2 安全策略

| 策略 | 实现 |
|------|------|
| **API Key 生成** | crypto.randomBytes(32)，高熵随机值 |
| **Secret 存储** | bcrypt 哈希存储，明文仅注册时返回一次 |
| **代理密码存储** | **AES-256-GCM 加密**，非明文存储 |
| **后端凭证** | AES-256-GCM 加密存储后端密码 |
| **JWT 签名** | HS256 算法，密钥从环境变量读取 |
| **传输安全** | Railway 自动提供 HTTPS |
| **频率限制** | per-key 限流 + Rate Limit Header |
| **IP 绑定** | 可选的 IP 白名单限制 |
| **操作审计** | 所有 API 调用记录日志 |
| **资源隔离** | Agent 只能访问自己的 Session 和数据 |
| **幂等保护** | UNIQUE INDEX 防止并发重复写入 |

### 8.3 频率限制设计

```
Global Limit    →  所有 Agent 总请求: 1000/s
Per-Key Limit   →  单 Agent: 60/min, 10000/day
Per-Endpoint    →  创建操作: 10/min
                →  查询操作: 120/min
                →  轮换操作: 30/min
```

---

## 9. 部署架构

### 9.1 Railway 部署方案

```
Railway Project
    │
    ├── Service: agent-layer (本服务)
    │   ├── 源码: ./Agent
    │   ├── 构建: npm run build
    │   ├── 启动: npm run start
    │   ├── 端口: $PORT (Railway 自动分配)
    │   └── 域名: <auto>.up.railway.app
    │
    ├── Service: backend (现有代理后端)
    │   ├── 内部域名: surprising-rejoicing
    │   │   .railway.internal
    │   └── 端口: 8000
    │
    └── Database: PostgreSQL
        ├── Agent Layer 数据库
        └── 代理后端数据库 (现有)
```

### 9.2 环境变量

```bash
# 服务配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/agent_db

# JWT
JWT_SECRET=<随机生成的密钥>
JWT_EXPIRES_IN=3600

# 代理后端
BACKEND_BASE_URL=http://surprising-rejoicing.railway.internal:8000
BACKEND_ADMIN_USERNAME=<管理员用户名>
BACKEND_ADMIN_PASSWORD=<管理员密码>

# 加密
ENCRYPTION_KEY=<AES-256密钥>

# 频率限制
RATE_LIMIT_PER_MIN=60
RATE_LIMIT_PER_DAY=10000
```

### 9.3 Railway 配置文件

```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/v1/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

---

## 10. 可观测性与监控

### 10.1 结构化日志

所有日志使用 JSON 格式输出（Pino），包含：

```json
{
  "level": "info",
  "time": "2026-02-15T10:00:00.000Z",
  "msg": "Session created",
  "request_id": "req_xxxx",
  "agent_id": 1,
  "session_id": "sess_xxxx",
  "latency_ms": 250,
  "backend_latency_ms": 200
}
```

### 10.2 关键指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `api_request_total` | Counter | API 总请求数 |
| `api_request_duration_ms` | Histogram | API 响应时间 |
| `api_error_total` | Counter | API 错误数 |
| `session_active_count` | Gauge | 活跃 Session 数 |
| `session_create_total` | Counter | Session 创建数 |
| `backend_request_total` | Counter | 后端请求数 |
| `backend_request_duration_ms` | Histogram | 后端响应时间 |
| `backend_error_total` | Counter | 后端错误数 |

### 10.3 健康检查

```
GET /v1/health

{
  "status": "healthy",
  "uptime_seconds": 86400,
  "checks": {
    "database": "ok",
    "backend": "ok",
    "memory_mb": 128
  },
  "version": "1.0.0"
}
```

---

## 11. 扩展规划

### Phase 1 — MVP（已完成 ✅）

- [x] Agent 注册 / 认证（纯 API Key + JWT 双模式）
- [x] 试用模式（免费额度，降低入门门槛）
- [x] 动态代理 Session 管理（异步创建）
- [x] 静态代理 Session 管理（异步创建）
- [x] 余额查询 / 充值
- [x] **Telemetry 遥测上报**（数据收集 + 健康指标）
- [x] Session 健康指标（risk_level / health_score）
- [x] 基础统计
- [x] Rate Limit Header（Retry-After 等）
- [x] Identity 字段预留（为智能调度做准备）
- [x] **NexaLayer NL 命令行**（受控自然语言 Agent，26 个意图）

### Phase 2 — 增强 + 指纹配置管理

> **目标**: 完成代理增强功能 + 指纹浏览器的配置数据层，
> 为 AI Agent 提供完整的"数字身份"管理能力。

#### 2A. 代理增强

- [ ] Webhook 事件推送
- [ ] **风险评分系统**（基于 Telemetry 数据计算）
- [ ] **智能调度逻辑**（自动选择最优代理）
- [ ] 代理健康检测与自动切换
- [ ] 智能推荐引擎
- [ ] **批量 Session 管理**
  - `POST /v1/sessions/bulk-create`
  - `POST /v1/sessions/bulk-terminate`
- [ ] Identity 池管理
- [ ] 使用量告警

#### 2B. 指纹配置管理（Profile Module）

- [ ] **浏览器配置 CRUD**
  - `POST /v1/profiles` — 创建配置
  - `GET /v1/profiles` — 列表查询（分组/标签/状态筛选）
  - `GET /v1/profiles/:id` — 配置详情
  - `PUT /v1/profiles/:id` — 更新配置
  - `DELETE /v1/profiles/:id` — 删除配置
- [ ] **指纹生成引擎**
  - `POST /v1/fingerprints/generate` — 随机生成完整指纹
  - `POST /v1/fingerprints/validate` — 校验指纹一致性
  - `GET /v1/fingerprints/templates` — 指纹模板库
  - 支持 50+ 参数: UA、屏幕、硬件、Canvas、WebGL、
    Audio、WebRTC、时区、语言、字体、Client Hints 等
- [ ] **配置克隆与批量创建**
  - `POST /v1/profiles/:id/duplicate` — 克隆配置
  - `POST /v1/profiles/batch-create` — 批量创建
- [ ] **配置导入导出**
  - `POST /v1/profiles/import` — JSON/CSV 导入
  - `GET /v1/profiles/export` — 导出
- [ ] **代理-指纹绑定**
  - `POST /v1/profiles/:id/bind-proxy` — 绑定 Session
  - 自动匹配: 根据 Profile 地理位置匹配代理
  - 一致性校验: 时区/语言/Geo 与代理 IP 匹配
- [ ] **配置分组管理**
  - `POST /v1/profile-groups` — CRUD
  - 标签系统、颜色标记、排序
- [ ] **Cookie & Storage 持久化**
  - 每个 Profile 独立的加密 Cookie 存储
  - LocalStorage 数据隔离
- [ ] **浏览器扩展管理**
  - 为 Profile 配置浏览器扩展列表
- [ ] **数据库新增 3 张表**
  - `browser_profiles` — 浏览器配置表
  - `fingerprint_configs` — 指纹配置表
  - `profile_groups` — 配置分组表

#### 2C. NL Agent 扩展 — 指纹配置命令

- [ ] `create_profile` — "创建一个美国 Chrome 浏览器配置"
- [ ] `list_profiles` — "查看我的浏览器配置"
- [ ] `update_profile` — "修改配置 xxx 的 UA"
- [ ] `delete_profile` — "删除配置 xxx"
- [ ] `duplicate_profile` — "复制配置 xxx"
- [ ] `bind_proxy` — "给配置 xxx 绑定美国代理"
- [ ] `generate_fingerprint` — "生成一个随机指纹"
- [ ] `batch_create_profiles` — "批量创建 10 个美国配置"
- [ ] `import_profile` — "导入浏览器配置"
- [ ] `export_profile` — "导出配置 xxx"
- [ ] `group_profile` — "把配置 xxx 移到美国分组"
- [ ] `tag_profile` — "给配置 xxx 添加标签 test"

#### 2D. NL Agent 扩展 — 指纹参数控制命令

- [ ] `set_user_agent` — "设置配置 xxx 的 UA 为 Chrome 120"
- [ ] `set_timezone` — "设置时区为 EST"
- [ ] `set_language` — "设置语言为英语"
- [ ] `set_canvas` — "设置 Canvas 指纹为 noise 模式"
- [ ] `set_webgl` — "设置 WebGL 指纹为 noise 模式"
- [ ] `set_audio` — "设置 AudioContext 为 noise 模式"
- [ ] `set_webrtc` — "禁用 WebRTC"
- [ ] `set_fonts` — "设置字体列表为 Arial, Helvetica"
- [ ] `set_plugins` — "设置插件列表"
- [ ] `set_client_hints` — "设置 Client Hints"

#### 2E. NL Agent 扩展 — 代理管理命令

- [ ] `add_proxy` — "添加代理 socks5://user:pass@1.2.3.4:1080"
- [ ] `import_proxy` — "批量导入代理"
- [ ] `verify_proxy` — "测试代理 xxx 的连通性"
- [ ] `rotate_proxy` — "轮换配置 xxx 的代理"
- [ ] `list_proxy` — "查看可用代理列表"

#### 2F. NL Agent 扩展 — 一致性校验命令

- [ ] `validate_fingerprint` — "检查配置 xxx 的指纹一致性"
- [ ] `auto_match_proxy` — "为配置 xxx 自动匹配最佳代理"

### Phase 3 — 网络执行平台 + 浏览器自动化

> **目标**: 完成浏览器实例管理、自动化引擎、任务队列、
> 反检测引擎和 MCP 接口，形成完整的 AI Agent 网络执行平台。

#### 3A. 浏览器实例管理

- [ ] **实例生命周期管理**
  - `POST /v1/browser/launch` — 启动浏览器（加载指纹+代理）
  - `POST /v1/browser/instances/:id/close` — 关闭实例
  - `GET /v1/browser/instances` — 列表（含资源监控）
  - `GET /v1/browser/instances/:id` — 实例详情
- [ ] **批量实例管理**
  - `POST /v1/browser/batch-launch` — 批量启动
  - `POST /v1/browser/batch-close` — 批量关闭
- [ ] **资源管理**
  - 内存/CPU 监控
  - 并发实例数限制
  - 空闲超时自动关闭
  - 崩溃检测和自动恢复

#### 3B. 浏览器自动化引擎

基于 Playwright 实现，支持 Chromium 和 Firefox。

- [ ] **页面导航**
  - `POST /v1/browser/instances/:id/navigate`
  - 支持 `wait_until`: load / domcontentloaded / networkidle
- [ ] **自动化动作序列**
  - `POST /v1/browser/instances/:id/execute`
  - 基础: click / fill / type / hover / select / scroll /
    press / wait / wait_for / drag
  - 输入: keyboard（组合键）/ mouse（坐标操作）
  - 文件: upload_file / download_file
  - 脚本: evaluate / screenshot
  - 网络: intercept_request / intercept_response / network_monitor
- [ ] **脚本执行**
  - `POST /v1/browser/instances/:id/evaluate`
  - 在浏览器上下文执行自定义 JS
- [ ] **截图与内容提取**
  - `POST /v1/browser/instances/:id/screenshot`
  - 支持全页截图、元素截图、PDF 导出
- [ ] **Cookie 管理**
  - `GET /v1/browser/instances/:id/cookies`
  - `POST /v1/browser/instances/:id/cookies`
  - Cookie 持久化到 Profile 存储

#### 3C. 任务队列系统

AI Agent 提交任务，系统自动调度执行。

- [ ] **任务 CRUD**
  - `POST /v1/tasks` — 提交任务（异步）
  - `GET /v1/tasks/:id` — 查询任务状态/结果
  - `GET /v1/tasks` — 任务列表
  - `DELETE /v1/tasks/:id` — 取消任务
  - `POST /v1/tasks/:id/retry` — 重试
- [ ] **任务类型**
  - `navigate` — 导航并获取页面内容
  - `scrape` — 数据抓取（含选择器提取）
  - `form_fill` — 表单填写和提交
  - `screenshot` — 截图任务
  - `custom_script` — 自定义脚本执行
- [ ] **调度策略**
  - 优先级队列: urgent > high > normal > low
  - 并发控制: per-agent 最大并发任务数
  - 超时管理: 单任务最大执行时间
  - 失败重试: 可配置重试次数和策略
- [ ] **数据库新增 3 张表**
  - `browser_instances` — 浏览器实例表
  - `browser_tasks` — 浏览器任务表
  - `browser_cookies` — Cookie 存储表

#### 3D. 反检测引擎

- [ ] **指纹注入引擎**
  - Canvas 指纹噪声注入（确定性噪声，同 Profile 同结果）
  - WebGL 渲染器/厂商伪装
  - AudioContext 频率偏移
  - WebRTC IP 伪装/禁用
  - 字体列表伪装
  - 插件列表伪装
  - Client Hints 响应伪装
  - navigator 属性全面覆盖
- [ ] **一致性校验器**
  - 时区 ↔ IP 地理位置匹配
  - 语言 ↔ 地区匹配
  - 屏幕分辨率 ↔ OS 匹配
  - UA 版本 ↔ 浏览器版本匹配
- [ ] **泄漏检测器**
  - WebRTC 真实 IP 泄漏检测
  - DNS 泄漏检测
  - Canvas 指纹唯一性验证
  - 时区不一致泄漏检测
- [ ] **检测测试接口**
  - `POST /v1/anti-detect/test` — 运行检测测试
  - `POST /v1/anti-detect/check-leaks` — 泄漏检测
  - 支持 Pixelscan、BrowserLeaks、CreepJS
- [ ] **真实设备指纹模板库**
  - 从真实设备采集指纹模板
  - 主流 OS/Browser 组合覆盖
  - 定期更新保持时效性

#### 3E. MCP Server 接口

- [ ] **MCP 工具定义**
  - `create_browser_profile` — 创建浏览器配置
  - `launch_browser` — 启动浏览器
  - `navigate_to` — 导航
  - `execute_browser_task` — 提交任务
  - `take_screenshot` — 截图
  - `close_browser` — 关闭浏览器
  - `get_page_content` — 获取页面内容
- [ ] **MCP 资源定义**
  - `profiles://` — 浏览器配置列表
  - `instances://` — 运行中的实例
  - `tasks://` — 任务列表
- [ ] **MCP Server 端点**
  - `GET /v1/mcp/tools` — 工具列表
  - `POST /v1/mcp/execute` — 执行工具

#### 3F. NL Agent 扩展 — 浏览器操作命令

- [ ] `launch_browser` — "启动配置 xxx 的浏览器"
- [ ] `close_browser` — "关闭浏览器 xxx"
- [ ] `restart_browser` — "重启浏览器 xxx"
- [ ] `batch_launch_browser` — "批量启动分组 A 的所有浏览器"
- [ ] `batch_close_browser` — "关闭所有浏览器"
- [ ] `list_browsers` — "查看运行中的浏览器"
- [ ] `navigate_to` — "用浏览器 xxx 访问 example.com"
- [ ] `take_screenshot` — "截图浏览器 xxx"
- [ ] `submit_task` — "用配置 xxx 抓取 example.com 的数据"
- [ ] `run_script` — "在浏览器 xxx 中执行脚本获取页面标题"
- [ ] `schedule_task` — "1 小时后用配置 xxx 截图 example.com"
- [ ] `batch_task` — "批量截图这 5 个网站"
- [ ] `query_task` — "查看任务 xxx 的状态"
- [ ] `run_detection_test` — "检测配置 xxx 的指纹质量"

### Phase 4 — Agent Browser OS（v3.0 新增）

> **目标**: 将 NexaLayer 从「代理中间层 + 指纹浏览器」升级为
> 真正的 **AI Agent 浏览器操作系统**。AI Agent 可以通过自然语言
> 完成「创建配置 → 绑定代理 → 打开网站 → 操作页面 → 提取数据」
> 的全链路操作。

#### 4A. Workspace 管理（工作区）

所有主流指纹浏览器都具备 Workspace 概念。当用户拥有
1000+ Profile 时，Workspace 是唯一可行的组织方式。

- [ ] **Workspace CRUD**
  - `POST /v1/workspaces` — 创建工作区
  - `GET /v1/workspaces` — 列表（含 Profile 数量统计）
  - `GET /v1/workspaces/:id` — 详情
  - `PUT /v1/workspaces/:id` — 更新
  - `DELETE /v1/workspaces/:id` — 删除
- [ ] **Workspace ↔ Profile 关联**
  - `POST /v1/workspaces/:id/profiles` — 移动 Profile 到工作区
  - `DELETE /v1/workspaces/:id/profiles/:profileId` — 从工作区移除
  - 一个 Profile 只属于一个 Workspace
- [ ] **NL 命令**
  - `create_workspace` — "创建工作区 Amazon"
  - `list_workspaces` — "查看工作区"
  - `delete_workspace` — "删除工作区 xxx"
  - `move_to_workspace` — "把配置 PRF-xxx 移到 Amazon"
- [ ] **数据库**: `workspaces` 表

```
workspaces
├── id (PK)
├── workspace_id (UNIQUE, VARCHAR 36)
├── agent_id (FK → agent_apps)
├── name (VARCHAR 200)
├── description (TEXT, nullable)
├── color (VARCHAR 7, nullable)
├── icon (VARCHAR 50, nullable)
├── sort_order (INT, default 0)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

`browser_profiles` 表新增 `workspace_id` 外键（nullable）。

---

#### 4B. 扩展指纹维度（从 10 → 21）

现有指纹维度：UA、Canvas、WebGL、WebRTC、Audio、
Timezone、Language、Fonts、Plugins、ClientHints。

新增 11 个指纹维度，覆盖真实指纹浏览器的完整需求：

| # | 维度 | Intent | 说明 |
|---|------|--------|------|
| 1 | OS | `set_os` | 操作系统（Windows/macOS/Linux） |
| 2 | CPU | `set_cpu` | CPU 核心数（2/4/8/16） |
| 3 | Memory | `set_memory` | 设备内存（2/4/8/16 GB） |
| 4 | GPU | `set_gpu` | GPU 型号（RTX 3060 等） |
| 5 | Screen | `set_screen` | 分辨率/DPR/色深 |
| 6 | MediaDevices | `set_media_devices` | 摄像头/麦克风枚举 |
| 7 | Battery | `set_battery` | Battery API 返回值 |
| 8 | WebGPU | `set_webgpu` | WebGPU adapter 信息 |
| 9 | Navigator | `set_navigator` | navigator 属性覆盖 |
| 10 | DeviceMemory | `set_device_memory` | navigator.deviceMemory |
| 11 | Gamepad | `set_gamepad` | Gamepad API 返回值 |

所有指纹参数统一存储在 `browser_profiles.fingerprint` JSON 字段中，
通过 `PUT /v1/profiles/:id` 更新对应子字段。

指纹 JSON 结构扩展：

```json
{
  "userAgent": "Mozilla/5.0 ...",
  "os": { "name": "Windows", "version": "10" },
  "cpu": { "cores": 8, "architecture": "x86" },
  "memory": { "deviceMemory": 8 },
  "gpu": { "vendor": "NVIDIA", "renderer": "RTX 3060" },
  "screen": {
    "width": 1920, "height": 1080,
    "dpr": 1, "colorDepth": 24
  },
  "canvas": { "mode": "noise", "seed": "..." },
  "webgl": { "mode": "noise", "vendor": "...", "renderer": "..." },
  "webrtc": { "mode": "disabled" },
  "audio": { "mode": "noise" },
  "timezone": "America/New_York",
  "language": ["en-US", "en"],
  "fonts": ["Arial", "Helvetica", ...],
  "plugins": [...],
  "clientHints": { "platform": "Windows", ... },
  "mediaDevices": { "cameras": 1, "microphones": 1, "speakers": 1 },
  "battery": { "charging": true, "level": 0.85 },
  "webgpu": { "vendor": "...", "architecture": "..." },
  "navigator": { "hardwareConcurrency": 8, "maxTouchPoints": 0, ... },
  "gamepad": { "enabled": false }
}
```

---

#### 4C. Profile 生命周期增强

现有: create / list / update / delete / duplicate / batch_create。

新增 Profile 生命周期状态管理：

| 状态 | 说明 |
|------|------|
| `active` | 正常使用 |
| `paused` | 暂停（不可启动浏览器） |
| `archived` | 归档（不显示在默认列表） |

- [ ] **NL 命令**
  - `pause_profile` — "暂停配置 PRF-xxx"
  - `resume_profile` — "恢复配置 PRF-xxx"
  - `archive_profile` — "归档配置 PRF-xxx"

---

#### 4D. 浏览器页面操作扩展

现有: navigate / screenshot / run_script。

新增完整的 Playwright 页面操作暴露给 NL 和 API：

**页面交互**

| API | Intent | 说明 |
|-----|--------|------|
| `POST /v1/browser/instances/:id/click` | `click_element` | 点击元素（CSS selector） |
| `POST /v1/browser/instances/:id/input` | `input_text` | 输入文本 |
| `POST /v1/browser/instances/:id/scroll` | `scroll_page` | 滚动页面 |
| `POST /v1/browser/instances/:id/wait` | `wait_for_element` | 等待元素出现 |
| `POST /v1/browser/instances/:id/hover` | `hover_element` | 悬停元素 |
| `POST /v1/browser/instances/:id/select` | `select_option` | 下拉选择 |

**数据提取**

| API | Intent | 说明 |
|-----|--------|------|
| `POST /v1/browser/instances/:id/extract-text` | `extract_text` | 提取文本内容 |
| `POST /v1/browser/instances/:id/extract-html` | `extract_html` | 提取 HTML |
| `POST /v1/browser/instances/:id/extract-links` | `extract_links` | 提取所有链接 |
| `POST /v1/browser/instances/:id/extract-table` | `extract_table` | 提取表格数据 |

**Cookie 管理**

| API | Intent | 说明 |
|-----|--------|------|
| `GET /v1/browser/instances/:id/cookies` | `export_cookies` | 导出 Cookie |
| `POST /v1/browser/instances/:id/cookies` | `import_cookies` | 导入 Cookie |
| `DELETE /v1/browser/instances/:id/cookies` | `clear_cookies` | 清除 Cookie |

**文件操作**

| API | Intent | 说明 |
|-----|--------|------|
| `POST /v1/browser/instances/:id/upload` | `upload_file` | 上传文件 |
| `POST /v1/browser/instances/:id/download` | `download_file` | 下载文件 |

---

#### 4E. 代理管理增强

现有: add / list / verify / bind / import / rotate。

新增：

| API | Intent | 说明 |
|-----|--------|------|
| `DELETE /v1/proxies/:id` | `delete_proxy` | 删除代理 |
| `POST /v1/proxies/:id/speed-test` | `proxy_speed_test` | 代理测速 |
| `POST /v1/proxies/:id/quality` | `proxy_quality_check` | 代理质量检测 |
| `POST /v1/proxy-pools` | `create_proxy_pool` | 创建代理池 |
| `GET /v1/proxy-pools` | `list_proxy_pools` | 查看代理池 |
| `DELETE /v1/proxy-pools/:id` | `delete_proxy_pool` | 删除代理池 |
| `POST /v1/profiles/:id/auto-select-proxy` | `auto_select_proxy` | 自动选择最佳代理 |

代理池模型：

```
proxy_pools
├── id (PK)
├── pool_id (UNIQUE, VARCHAR 36)
├── agent_id (FK → agent_apps)
├── name (VARCHAR 200)
├── country_code (VARCHAR 10, nullable)
├── proxy_type (VARCHAR 10)
├── proxy_ids (JSON, proxy ID 列表)
├── rotation_strategy (VARCHAR 20, default 'round_robin')
├── health_check_interval_sec (INT, default 300)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

---

#### 4F. Workflow 自动化编排

现有任务系统是单步任务。Workflow 实现多步骤编排：

- [ ] **Workflow CRUD**
  - `POST /v1/workflows` — 创建工作流
  - `GET /v1/workflows` — 列表
  - `GET /v1/workflows/:id` — 详情
  - `PUT /v1/workflows/:id` — 更新
  - `DELETE /v1/workflows/:id` — 删除
  - `POST /v1/workflows/:id/run` — 执行
  - `POST /v1/workflows/:id/stop` — 停止
- [ ] **调度管理**
  - `PUT /v1/workflows/:id/schedule` — 设置定时
  - cron 表达式支持
  - 一次性 / 周期性 / 间隔执行
- [ ] **NL 命令**
  - `create_workflow` — "创建流程：抓取 Amazon 商品"
  - `list_workflows` — "查看自动化流程"
  - `run_workflow` — "运行流程 WF-xxx"
  - `delete_workflow` — "删除流程 WF-xxx"
  - `schedule_workflow` — "每天 8 点运行流程 WF-xxx"
- [ ] **数据库**: `workflows` + `workflow_steps` 表

```
workflows
├── id (PK)
├── workflow_id (UNIQUE, VARCHAR 36)
├── agent_id (FK → agent_apps)
├── name (VARCHAR 200)
├── description (TEXT, nullable)
├── status (VARCHAR 20: draft/active/paused/archived)
├── trigger_type (VARCHAR 20: manual/scheduled/webhook)
├── schedule_cron (VARCHAR 100, nullable)
├── schedule_timezone (VARCHAR 50, nullable)
├── max_retries (INT, default 3)
├── timeout_ms (INT, default 300000)
├── last_run_at (TIMESTAMPTZ, nullable)
├── last_run_status (VARCHAR 20, nullable)
├── run_count (INT, default 0)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

workflow_steps
├── id (PK)
├── workflow_id (FK → workflows.workflow_id)
├── step_order (INT)
├── action_type (VARCHAR 50: navigate/click/input/extract/
│   screenshot/wait/scroll/evaluate/condition/loop)
├── config (JSON, 步骤参数)
├── on_error (VARCHAR 20: retry/skip/abort, default 'abort')
├── timeout_ms (INT, default 30000)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

Workflow 执行示例：

```json
{
  "name": "Amazon 商品抓取",
  "steps": [
    { "action": "navigate", "url": "https://amazon.com" },
    { "action": "input", "selector": "#twotabsearchtextbox", "text": "iphone" },
    { "action": "click", "selector": "#nav-search-submit-button" },
    { "action": "wait", "selector": ".s-result-item", "timeout_ms": 5000 },
    { "action": "extract_table", "selector": ".s-result-item", "fields": ["title", "price"] }
  ]
}
```

---

#### 4G. 数据管理

- [ ] **浏览器数据管理 API**
  - `GET /v1/profiles/:id/data` — 导出配置数据（cookie + localStorage + cache）
  - `POST /v1/profiles/:id/data` — 导入配置数据
  - `DELETE /v1/profiles/:id/cache` — 清理缓存
  - `DELETE /v1/profiles/:id/storage` — 清理 localStorage
- [ ] **NL 命令**
  - `export_browser_data` — "导出配置 PRF-xxx 的数据"
  - `import_browser_data` — "导入浏览器数据到 PRF-xxx"
  - `clear_cache` — "清理配置 PRF-xxx 的缓存"
  - `clear_storage` — "清理配置 PRF-xxx 的存储"

---

#### 4H. 系统命令

- [ ] **系统 API**
  - `GET /v1/system/status` — 系统状态总览
  - `GET /v1/system/resources` — 资源使用（内存/CPU/磁盘/浏览器实例数）
  - `GET /v1/system/logs` — 最近操作日志
- [ ] **NL 命令**
  - `system_status` — "查看系统状态"
  - `resource_usage` — "查看资源使用"
  - `view_logs` — "查看最近日志"

---

#### 4I. NL 命令架构升级总览

升级为 9 大模块：

```
NexaLayer NL Agent OS CLI
├── 📋 账户 (Account)
│   ├── 查余额 / 查统计 / 查订单 / 查交易
│   ├── 创建用户 / 分配额度 / 重置密码
│   └── 开通代理 / 续费 / 提取动态
├── 🖥️ 配置 (Profile)
│   ├── 创建 / 查看 / 复制 / 删除
│   ├── 暂停 / 恢复 / 归档
│   ├── 导入 / 导出 / 批量创建
│   ├── 分组 / 标签
│   └── 校验指纹一致性
├── 🔧 指纹 (Fingerprint) — 21 个维度
│   ├── 基础: UA / OS / Timezone / Language
│   ├── 硬件: CPU / Memory / GPU / Screen / Battery
│   ├── 浏览器: Canvas / WebGL / WebRTC / Audio / Fonts
│   ├── 能力: Plugins / ClientHints / MediaDevices
│   └── 高级: WebGPU / Navigator / DeviceMemory / Gamepad
├── 🌐 代理 (Proxy)
│   ├── 添加 / 删除 / 查看 / 验证 / 测速
│   ├── 绑定 / 轮换 / 自动选择
│   ├── 质量检测
│   └── 代理池管理
├── 🌍 浏览器 (Browser)
│   ├── 启动 / 关闭 / 重启 / 批量
│   ├── 导航 / 截图
│   ├── 点击 / 输入 / 滚动 / 等待 / 悬停 / 选择
│   ├── 提取文本 / HTML / 链接 / 表格
│   ├── Cookie: 导出 / 导入 / 清除
│   └── 文件: 上传 / 下载
├── ⚡ 自动化 (Automation)
│   ├── 提交任务 / 查看状态
│   ├── 创建流程 / 运行流程 / 删除流程
│   ├── 定时调度
│   └── 运行脚本
├── 📁 工作区 (Workspace)
│   ├── 创建 / 查看 / 删除
│   └── 移动配置
├── 💾 数据 (Data)
│   ├── 导出数据 / 导入数据
│   └── 清理缓存 / 清理存储
└── 🔧 系统 (System)
    ├── 系统状态
    ├── 资源使用
    └── 查看日志
```

**核心价值**: AI Agent 可以用自然语言完成全链路操作：

```
帮我创建 10 个美国 Chrome 配置
绑定洛杉矶代理
打开 Amazon
搜索 iphone
抓取前 10 个商品
```

Agent 自动创建 Workflow 并执行 — 这就是 **Agent Browser OS**。

---

### Phase 5 — 生态

- [ ] SDK 发布（Python / Node.js / Go）
- [ ] OpenAPI 规范文档
- [ ] 沙箱环境
- [ ] 合作伙伴 API
- [ ] 计费优化（预留、套餐）
- [ ] 团队协作功能（角色权限、配置共享、操作审计）
- [ ] Agent Marketplace

---

## 12. 目录结构

```
Agent/
├── docs/
│   ├── agentDesign.md          # 本文档
│   ├── agentManual.md          # 用户使用手册
│   ├── agentTest.md            # 测试设计文档
│   ├── nexalayerNL.md          # NL Agent 设计文档
│   └── FingerprintBrowser.md   # 指纹浏览器参考规格
├── src/
│   ├── index.ts                # 应用入口
│   ├── app.ts                  # Fastify 应用配置
│   ├── config/
│   │   ├── env.ts              # 环境变量配置
│   │   └── constants.ts        # 常量定义
│   ├── modules/
│   │   ├── auth/               # 认证模块 (Phase 1)
│   │   ├── account/            # 账户模块 (Phase 1)
│   │   ├── session/            # 会话模块 (Phase 1)
│   │   ├── billing/            # 计费模块 (Phase 1)
│   │   ├── product/            # 产品模块 (Phase 1)
│   │   ├── telemetry/          # 遥测模块 (Phase 1)
│   │   ├── stats/              # 统计模块 (Phase 1)
│   │   ├── nl-agent/           # NL Agent 模块 (Phase 1)
│   │   │   ├── nl.routes.ts
│   │   │   ├── nl.controller.ts
│   │   │   ├── nl.service.ts
│   │   │   ├── nl.schema.ts
│   │   │   ├── intent-parser.ts
│   │   │   ├── llm-parser.ts
│   │   │   ├── executor.ts
│   │   │   ├── executor-utils.ts
│   │   │   ├── geo-mapping.ts
│   │   │   ├── help-resolver.ts
│   │   │   ├── suggestions.ts
│   │   │   ├── conversation-context.ts
│   │   │   └── nl-auth.middleware.ts
│   │   ├── profile/            # 指纹配置模块 (Phase 2) ★
│   │   │   ├── profile.routes.ts
│   │   │   ├── profile.controller.ts
│   │   │   ├── profile.service.ts
│   │   │   ├── profile.schema.ts
│   │   │   ├── fingerprint.service.ts
│   │   │   ├── proxy-binding.service.ts
│   │   │   ├── proxy-manager.service.ts
│   │   │   └── profile-group.service.ts
│   │   ├── browser/            # 浏览器实例模块 (Phase 3) ★
│   │   │   ├── browser.routes.ts
│   │   │   ├── browser.controller.ts
│   │   │   ├── browser.service.ts
│   │   │   ├── browser.schema.ts
│   │   │   ├── automation.service.ts
│   │   │   └── cookie.service.ts
│   │   ├── task/               # 任务队列模块 (Phase 3) ★
│   │   │   ├── task.routes.ts
│   │   │   ├── task.controller.ts
│   │   │   ├── task.service.ts
│   │   │   ├── task.schema.ts
│   │   │   ├── task-scheduler.ts
│   │   │   └── script-runner.ts
│   │   ├── anti-detect/        # 反检测引擎 (Phase 3) ★
│   │   │   ├── anti-detect.routes.ts
│   │   │   ├── anti-detect.controller.ts
│   │   │   ├── anti-detect.service.ts
│   │   │   ├── fingerprint-injector.ts
│   │   │   ├── consistency-validator.ts
│   │   │   ├── leak-detector.ts
│   │   │   └── template-database.ts
│   │   ├── workspace/          # 工作区模块 (Phase 4) ★
│   │   │   ├── workspace.routes.ts
│   │   │   ├── workspace.controller.ts
│   │   │   ├── workspace.service.ts
│   │   │   └── workspace.schema.ts
│   │   ├── workflow/           # 工作流模块 (Phase 4) ★
│   │   │   ├── workflow.routes.ts
│   │   │   ├── workflow.controller.ts
│   │   │   ├── workflow.service.ts
│   │   │   ├── workflow.schema.ts
│   │   │   └── workflow-runner.ts
│   │   ├── data/               # 数据管理模块 (Phase 4) ★
│   │   │   ├── data.routes.ts
│   │   │   ├── data.controller.ts
│   │   │   └── data.service.ts
│   │   ├── system/             # 系统模块 (Phase 4) ★
│   │   │   ├── system.routes.ts
│   │   │   ├── system.controller.ts
│   │   │   └── system.service.ts
│   │   └── mcp/                # MCP Server (Phase 3) ★
│   │       ├── mcp.routes.ts
│   │       ├── mcp.controller.ts
│   │       ├── mcp.service.ts
│   │       └── mcp-tools.ts
│   ├── engine/                 # 浏览器引擎层 (Phase 3) ★
│   │   ├── playwright-controller.ts
│   │   ├── cdp-bridge.ts
│   │   ├── fingerprint-scripts/
│   │   │   ├── canvas-spoof.js
│   │   │   ├── webgl-spoof.js
│   │   │   ├── audio-spoof.js
│   │   │   ├── webrtc-spoof.js
│   │   │   ├── navigator-spoof.js
│   │   │   ├── fonts-spoof.js
│   │   │   └── client-hints-spoof.js
│   │   └── instance-manager.ts
│   ├── gateway/
│   │   ├── backend-client.ts
│   │   ├── error-mapper.ts
│   │   └── types.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rate-limit.ts
│   │   ├── logger.ts
│   │   └── error-handler.ts
│   ├── utils/
│   │   ├── crypto.ts
│   │   ├── id-generator.ts
│   │   ├── referral.ts
│   │   └── response.ts
│   └── types/
│       ├── api.types.ts
│       └── global.d.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── smoke/                  # 冒烟测试
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── package.json
├── tsconfig.json
├── railway.toml
├── Dockerfile
└── README.md
```

---

## 附录 A: 后端 API 映射表

Agent Layer 对代理后端 API 的调用映射：

| Agent Layer API | 后端 API | 说明 |
|-----------------|----------|------|
| `POST /v1/account/register` | `POST /api/open/app/user/create/v2` | 创建后端用户 |
| `POST /v1/auth/token` | `POST /api/auth/login` | 获取后端 Token |
| `GET /v1/billing/balance` | `GET /api/open/app/user/balance/current` | 查询余额 |
| `POST /v1/billing/recharge` | `POST /api/usdt/create-order` | 创建充值单 |
| `GET /v1/billing/recharge/:id/status` | `GET /api/usdt/check-status` | 充值状态 |
| `GET /v1/products` | `GET /api/settings/prices?is_global=false&proxy_types=101,102,103` + 客户端地域筛选 | 产品列表 |
| `GET /v1/products/regions` | `GET /api/areas/hierarchy` | 地域列表 |
| `POST /v1/sessions` (dynamic) | `POST /api/business/dynamic-proxy/open` | 开通动态代理 |
| `POST /v1/sessions` (static) | `POST /api/open/app/static/order/create/v2` | 开通静态代理 |
| `GET /v1/sessions` | `GET /api/open/app/static/order/list/v2?search=X&is_search=true` + 动态查询 | 查询订单 |
| `POST /v1/sessions/:id/rotate` | `POST /api/open/app/proxy/refresh/v2/{no}` | 代理轮换 |
| `POST /v1/sessions/:id/renew` | `POST /api/renew-order` | 续费 |
| `POST /v1/sessions/:id/whitelist` | `POST /api/open/app/proxy/addIpWhiteList/v2` | IP白名单 |
| `GET /v1/sessions/:id/usage` | `GET /api/proxy/dynamic-resource` + 流量查询 | 使用量 |
| `GET /v1/billing/transactions` | `GET /api/open/app/user/transactions` | 交易记录 |
| `GET /v1/stats/overview` | `GET /api/open/app/dashboard/info/v2` | 概览统计 |
| `POST /v1/sessions/:id/report-event` | 本地处理（不调用后端） | Telemetry 上报 |
| `GET /v1/sessions/:id/health` | 本地处理（不调用后端） | 健康指标 |
| `POST /v1/profiles` | 本地处理 | 创建浏览器配置 |
| `PUT /v1/profiles/:id` | 本地处理 | 更新配置（含指纹参数修改） |
| `POST /v1/profiles/import` | 本地处理 | 批量导入配置 |
| `GET /v1/profiles/export` | 本地处理 | 导出配置 |
| `POST /v1/fingerprints/generate` | 本地处理 | 生成指纹 |
| `POST /v1/fingerprints/validate` | 本地处理 | 校验指纹一致性 |
| `POST /v1/proxies` | 本地处理 | 添加外部代理 |
| `POST /v1/proxies/import` | 本地处理 | 批量导入代理 |
| `POST /v1/proxies/:id/verify` | 外部连通性检测 | 测试代理 |
| `GET /v1/proxies` | 本地处理 | 代理列表 |
| `POST /v1/browser/launch` | Playwright 引擎 | 启动浏览器 |
| `POST /v1/browser/instances/:id/execute` | Playwright 引擎 | 自动化动作序列 |
| `POST /v1/browser/instances/:id/run-script` | Playwright 引擎 | 直接运行脚本 |
| `POST /v1/browser/instances/:id/network-monitor` | Playwright HAR | 网络监控 |
| `POST /v1/tasks` | 本地任务队列 | 提交浏览器任务 |
| `POST /v1/tasks/batch` | 本地任务队列 | 批量提交任务 |
| `POST /v1/tasks/schedule` | 本地调度器 | 定时任务 |
| `POST /v1/anti-detect/test` | Playwright + 检测站 | 反检测测试 |
| `POST /v1/mcp/execute` | 内部路由分发 | MCP 工具调用 |
| `POST /v1/workspaces` | 本地处理 | 创建工作区 |
| `GET /v1/workspaces` | 本地处理 | 工作区列表 |
| `POST /v1/workspaces/:id/profiles` | 本地处理 | 移动配置到工作区 |
| `POST /v1/workflows` | 本地处理 | 创建工作流 |
| `POST /v1/workflows/:id/run` | Playwright 引擎 | 执行工作流 |
| `POST /v1/proxy-pools` | 本地处理 | 创建代理池 |
| `POST /v1/browser/instances/:id/click` | Playwright 引擎 | 点击元素 |
| `POST /v1/browser/instances/:id/input` | Playwright 引擎 | 输入文本 |
| `POST /v1/browser/instances/:id/scroll` | Playwright 引擎 | 滚动页面 |
| `POST /v1/browser/instances/:id/wait` | Playwright 引擎 | 等待元素 |
| `POST /v1/browser/instances/:id/extract-text` | Playwright 引擎 | 提取文本 |
| `POST /v1/browser/instances/:id/extract-links` | Playwright 引擎 | 提取链接 |
| `POST /v1/browser/instances/:id/extract-table` | Playwright 引擎 | 提取表格 |
| `GET /v1/browser/instances/:id/cookies` | Playwright 引擎 | 导出 Cookie |
| `POST /v1/browser/instances/:id/cookies` | Playwright 引擎 | 导入 Cookie |
| `DELETE /v1/browser/instances/:id/cookies` | Playwright 引擎 | 清除 Cookie |
| `GET /v1/profiles/:id/data` | 本地处理 | 导出浏览器数据 |
| `DELETE /v1/profiles/:id/cache` | 本地处理 | 清理缓存 |
| `GET /v1/system/status` | 本地处理 | 系统状态 |
| `GET /v1/system/resources` | 本地处理 | 资源使用 |

---

## 附录 B: 错误码对照表

| Agent Layer 错误码 | HTTP 状态码 | 说明 |
|-------------------|:-----------:|------|
| `AUTH_INVALID_KEY` | 401 | API Key 无效 |
| `AUTH_EXPIRED_TOKEN` | 401 | Token 过期 |
| `AUTH_INSUFFICIENT_PERMISSION` | 403 | 权限不足 |
| `RATE_LIMIT_EXCEEDED` | 429 | 频率超限 |
| `ACCOUNT_DISABLED` | 403 | 账户已禁用 |
| `INSUFFICIENT_BALANCE` | 402 | 余额不足 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `SESSION_EXPIRED` | 410 | 会话已过期 |
| `SESSION_LIMIT_REACHED` | 429 | 会话数量达到上限 |
| `PRODUCT_NOT_FOUND` | 404 | 产品不存在 |
| `PRODUCT_OUT_OF_STOCK` | 409 | 库存不足 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `IDEMPOTENCY_CONFLICT` | 409 | 幂等键冲突 |
| `BACKEND_ERROR` | 502 | 代理后端异常 |
| `BACKEND_TIMEOUT` | 504 | 代理后端超时 |
| `INTERNAL_ERROR` | 500 | 内部错误 |
| `PROFILE_NOT_FOUND` | 404 | 浏览器配置不存在 |
| `PROFILE_LIMIT_REACHED` | 429 | 配置数量达到上限 |
| `FINGERPRINT_INVALID` | 400 | 指纹参数不一致 |
| `INSTANCE_NOT_FOUND` | 404 | 浏览器实例不存在 |
| `INSTANCE_LIMIT_REACHED` | 429 | 实例数量达到上限 |
| `INSTANCE_LAUNCH_FAILED` | 500 | 浏览器启动失败 |
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `TASK_ALREADY_COMPLETED` | 409 | 任务已完成 |
| `TASK_QUEUE_FULL` | 429 | 任务队列已满 |
| `BROWSER_CRASHED` | 500 | 浏览器崩溃 |
| `PROXY_NOT_FOUND` | 404 | 代理不存在 |
| `PROXY_VERIFY_FAILED` | 422 | 代理验证失败（不可连接） |
| `PROXY_IMPORT_FAILED` | 400 | 代理导入格式错误 |
| `PROFILE_IMPORT_FAILED` | 400 | 配置导入格式错误 |
| `FINGERPRINT_INCONSISTENT` | 422 | 指纹与代理不一致 |
| `SCRIPT_TIMEOUT` | 408 | 脚本执行超时 |
| `SCRIPT_ERROR` | 500 | 脚本执行出错 |
| `SCHEDULE_INVALID` | 400 | 调度参数无效 |
| `WORKSPACE_NOT_FOUND` | 404 | 工作区不存在 |
| `WORKSPACE_NAME_DUPLICATE` | 409 | 工作区名称重复 |
| `WORKFLOW_NOT_FOUND` | 404 | 工作流不存在 |
| `WORKFLOW_ALREADY_RUNNING` | 409 | 工作流已在运行 |
| `WORKFLOW_STEP_FAILED` | 500 | 工作流步骤执行失败 |
| `PROXY_POOL_NOT_FOUND` | 404 | 代理池不存在 |
| `PROXY_POOL_EMPTY` | 409 | 代理池为空 |
| `ELEMENT_NOT_FOUND` | 404 | 页面元素未找到 |
| `ELEMENT_NOT_VISIBLE` | 422 | 页面元素不可见 |
| `NAVIGATION_TIMEOUT` | 408 | 页面导航超时 |
| `DATA_EXPORT_FAILED` | 500 | 数据导出失败 |

---

## 附录 C: 术语表

| 术语 | 说明 |
|------|------|
| **Agent** | AI 智能体，通过 API 使用代理服务的程序 |
| **Session** | 代理会话，封装底层代理资源的抽象概念 |
| **Agent Layer** | 本系统，AI Agent 网络执行层 |
| **代理后端** | 现有的 IP 代理管理系统 |
| **静态代理** | 固定 IP 的代理，适合需要稳定 IP 的场景 |
| **动态代理** | 可轮换 IP 的代理，适合需要大量不同 IP 的场景 |
| **轮换 (Rotate)** | 更换当前使用的代理 IP |
| **API Key** | Agent 的身份标识 |
| **API Secret** | Agent 的密钥，用于认证 |
| **Backend Token** | 代理后端的 JWT Token |
| **幂等键** | 保证请求幂等性的唯一标识 |
| **Profile** | 浏览器配置文件，包含指纹参数和代理绑定 |
| **指纹 (Fingerprint)** | 浏览器环境的数字特征集合（UA、Canvas、WebGL 等） |
| **Browser Instance** | 运行中的浏览器进程实例 |
| **Task** | 浏览器自动化任务，异步执行 |
| **Anti-Detect** | 反检测，通过伪装指纹避免网站追踪 |
| **CDP** | Chrome DevTools Protocol，浏览器调试协议 |
| **MCP** | Model Context Protocol，AI Agent 工具协议 |
| **Playwright** | 微软开源的浏览器自动化框架 |
| **Workspace** | 工作区，用于组织和管理大量 Profile 的容器 |
| **Workflow** | 自动化工作流，包含多个步骤的编排任务 |
| **Proxy Pool** | 代理池，一组代理的集合，支持轮换策略 |
| **Agent Browser OS** | Agent 浏览器操作系统，NexaLayer 的终极形态 |
| **NL Agent OS CLI** | 自然语言 Agent 操作系统命令行界面 |

---

*文档结束 — 请 Review 后进行编码阶段*
