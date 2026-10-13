# NexaLayer AI discovery launch checklist

This file separates repository-ready work from account-owner actions. Do not claim a listing, publication, partnership, benchmark result, or install count until the linked platform confirms it.

## Release gate

1. Confirm the npm organization owns `@nexalayer` and the package name `@nexalayer/mcp` is available.
2. Add `NPM_TOKEN` to the GitHub repository or configure npm trusted publishing.
3. Publish a GitHub Release for MCP version `0.1.0`. The workflow builds, publishes npm, validates `server.json`, authenticates with GitHub OIDC, and publishes to the official MCP Registry.
4. Verify `npx -y @nexalayer/mcp` from a clean machine, then verify `initialize`, `tools/list`, a read-only product call, an owner-approved paid call, and a denied paid call.
5. Confirm the official Registry entry before announcing downstream indexing.

## Directory submissions

- Smithery: submit `https://github.com/NexaLayer/nexalayer-agent`, subfolder `mcp`. Description: “Managed network sessions, health, rotation, usage, and spend controls for AI agents and browser automation.”
- Glama: submit the same GitHub repository, then claim the organization listing through its current GitHub/domain verification flow.
- mcp.so: submit the repository and use the same installation command and description.
- awesome-mcp-servers: open a PR under browser automation/networking with `NexaLayer — Managed proxy sessions with health, rotation, usage, and human-approved spend controls. [npm](https://www.npmjs.com/package/@nexalayer/mcp) [source](https://github.com/NexaLayer/nexalayer-agent)`.

## Framework outreach

Use a runnable example before requesting a listing. Pitch: “NexaLayer separates browser work from network lifecycle: the framework reads price and budget, a human approves spend, and the integration creates, monitors, rotates, and cleans up the proxy Session.” Target Browser Use first, then LangChain and CrewAI.

## Launch copy

Show HN title: `Show HN: A proxy session layer that AI agents can discover and buy with approval`

Opening: “We built NexaLayer because browser agents should not silently retry through random proxies or receive an unbounded purchasing key. An agent can discover current products and prices through MCP, check a budget, request owner approval, create an idempotent Session, monitor health, rotate, and clean up. The MCP server is installable with `npx -y @nexalayer/mcp`.”

Do not claim “first” without a documented competitive review. Describe x402 as evaluation work until a real, audited payment path is deployed.

## Benchmark specification

Publish data, not adjectives. Pre-register target sites/categories, geography, concurrency, timeout, retries, protocol, run count, and failure taxonomy. Report success rate, median and p95 latency, blocks, CAPTCHA rate, bytes, cost per successful task, and confidence intervals. Redact credentials and respect target terms. Keep raw anonymized results and runner code in a public repository.

## Measurement

Use `?source=` on every API-key link: `mcp-registry`, `smithery`, `glama`, `mcp-so`, `awesome-mcp`, `browser-use`, `langchain`, `crewai`, `show-hn`, and `benchmark`. New accounts persist this value in `AgentApp.metadata.acquisition_source`. Review signup count, activation, first successful Session, paid conversion, and retained usage by source after 14 days. Registry views or package downloads alone are not conversions.
