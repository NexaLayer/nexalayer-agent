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
npm run test:smoke
```

Smoke tests may create real Agent accounts, proxy sessions, orders, or billing
records depending on environment configuration. Review `docs/agentTest.md` and
the target environment before running them.

## Repository Origin

This code was split out from:

```text
/Users/minzhenfa/sourceCode/wan-workspace/IPProxy/Agent
```

The intended GitHub repository is:

```text
NexaLayer/nexalayer-agent
```
