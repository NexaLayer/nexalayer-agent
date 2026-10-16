# NexaLayer Agent

NexaLayer MCP Server — a Model Context Protocol (MCP) server that lets AI agents create and manage proxy sessions with budget guardrails.

The MCP implementation is in [`mcp/`](./mcp/), with its source entry point at [`mcp/src/index.ts`](./mcp/src/index.ts). The published package builds that file to the runtime entry path `mcp/dist/index.js`.

Current public starting prices are **$0.23/GB** for dynamic proxy sessions and
**$1.05/month** for shared static proxy sessions. Query
`GET /v1/public/products` or the authenticated product catalog for the current,
authoritative quote and availability before creating a paid session.

## MCP Server

### Install

Run the published stdio server with npm:

```bash
npx -y @nexalayer/mcp
```

Or build and run the existing Docker image from the repository root:

```bash
docker build -t nexalayer-mcp ./mcp
docker run -i --rm \
  -e NEXALAYER_API_KEY="$NEXALAYER_API_KEY" \
  nexalayer-mcp
```

The Docker image uses stdio and does not expose a port.

### Configure

Set `NEXALAYER_API_KEY` for API-backed tool calls. The server can start and expose `initialize` and `tools/list` without a key so MCP clients and directories can discover its capabilities. `NEXALAYER_BASE_URL` is an optional override.

Claude Desktop and Cursor both accept an `mcpServers` configuration like this:

```json
{
  "mcpServers": {
    "nexalayer": {
      "command": "npx",
      "args": ["-y", "@nexalayer/mcp"],
      "env": {
        "NEXALAYER_API_KEY": "agk_your_key"
      }
    }
  }
}
```

### Tools

| Tool | Description | Charges |
| --- | --- | --- |
| `nexalayer_list_products` | List the compact, paginated catalog of available proxy products and current prices. | No |
| `nexalayer_create_session` | Create a dynamic or static proxy session with an idempotency key. | **Yes — deducts from the account balance** |
| `nexalayer_rotate_session` | Rotate a dynamic session when health or telemetry recommends it. | May affect paid usage |
| `nexalayer_terminate_session` | Terminate a session and release its network resource; early termination does not imply a refund. | No new charge |
| `nexalayer_session_health` | Read a session health score and rotation recommendation. | No |
| `nexalayer_session_usage` | Read traffic and request usage for a session. | No |
| `nexalayer_get_budget` | Read spend limits, current spend, pause state, and daily reset. | No |
| `nexalayer_set_budget` | Set API-key and daily spend limits, alerts, and pause behavior. | No direct charge |
| `nexalayer_usage_alerts` | Read actionable budget-threshold alerts. | No |
| `nexalayer_get_balance` | Read the account balance and trial-credit state. | No |
| `nexalayer_list_transactions` | List billing transactions for audit and reconciliation. | No |

**Transport:** stdio.

See the [`mcp/` package README](./mcp/README.md) for packaging, Docker, pricing, and approval-policy details.

## Backend API

The repository also contains the Agent Layer backend for NexaLayer, the Network Execution Layer for AI Agents.

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
dynamic session, polls until active, explicitly requests credentials with
`include_credentials=true`, checks `proxy.full_url`, reports telemetry,
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

Session detail and rotation responses hide `proxy.full_url` by default. Send
`include_credentials=true` only when the caller needs to connect, and never log
the returned credentials. Read measured traffic from
`GET /v1/sessions/{session_id}/usage`. Unknown product numbers return HTTP 404
with `PRODUCT_NOT_FOUND`; a quote/upstream charge discrepancy is rejected before
charging with HTTP 409 and `PRICE_MISMATCH`.

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
