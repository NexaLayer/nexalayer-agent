# NexaLayer Agent

Agent Layer backend for NexaLayer, the Network Execution Layer for AI Agents.

This service exposes API-first capabilities for AI Agent, Playwright, Puppeteer,
Browser-use, crawler, and automation workflows:

- Agent account registration and API key authentication
- Dynamic and static proxy session lifecycle management
- Session telemetry, health scoring, and rotation recommendations
- Billing, balance, recharge, transaction, and usage-facing endpoints
- Natural-language agent routes for controlled proxy network operations

## Local Development

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

## Useful Commands

```bash
npm run build
npm run lint
npm test
npm run test:phase0
npm run test:phase0:real
npm run test:phase0:static
npm run test:smoke
```

`npm run test:phase0` is the safe profile. It validates registration,
API key auth, product listing, balance, and transactions without creating a
paid proxy session.

`npm run test:phase0:real` sets `PHASE0_ALLOW_PAID=1` and creates one low-volume
dynamic session, polls until active, checks `proxy.full_url`, reports telemetry,
reads health and billing, then terminates the session in a cleanup step. Use
`NEXALAYER_PRODUCT_NO`, `PHASE0_QUANTITY`, and `PHASE0_PRINT_PROXY_URL=1` when
you need a specific product or need to inspect the returned proxy URL.

`npm run test:phase0:static` creates one minimal static session, polls for
proxy info, reports telemetry, reads health and billing, then terminates the
session and releases the static resource. It is a paid smoke profile and should
only be used in controlled environments.

The broader `npm run test:smoke` suite may create real Agent accounts, proxy
sessions, orders, or billing records depending on environment configuration.
Review `docs/agentTest.md` and the target environment before running it.

## Chinese Docs and Examples

- 中文文档首页: [docs/zh/README.md](./docs/zh/README.md)
- 中文 Quick Start: [docs/zh/quick-start.md](./docs/zh/quick-start.md)
- Playwright 中文 Demo: [docs/zh/playwright-demo.md](./docs/zh/playwright-demo.md)
- Python 中文示例说明: [examples/python-quickstart/README.zh.md](./examples/python-quickstart/README.zh.md)
- Playwright 中文示例代码: [examples/playwright-zh](./examples/playwright-zh)

NexaLayer is not a raw proxy IP service. The Chinese MVP documentation presents
it as a session-based network execution layer for Playwright, Puppeteer,
Browser-use, AI browser agents, crawlers, and automation workflows.

## Repository Origin

This code was split out from:

```text
/Users/minzhenfa/sourceCode/wan-workspace/IPProxy/Agent
```

The intended GitHub repository is:

```text
NexaLayer/nexalayer-agent
```
