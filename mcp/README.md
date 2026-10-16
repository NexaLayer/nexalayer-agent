# NexaLayer MCP Server

This directory contains the MCP server package and implementation. For the repository overview, installation options, complete 11-tool catalog, and backend relationship, see the [root README](../README.md).

Connect an MCP client to NexaLayer products, sessions, health, usage, and spend controls.

```json
{
  "mcpServers": {
    "nexalayer": {
      "command": "npx",
      "args": ["-y", "@nexalayer/mcp"],
      "env": { "NEXALAYER_API_KEY": "agk_your_key" }
    }
  }
}
```

The server writes protocol messages only to stdout. API errors go through MCP tool results. Tool annotations mark reads, paid writes, policy changes, and destructive cleanup so compatible clients can apply approval policies.

## Tools

- Read: products and exact prices, health, usage, budget, alerts, balance, and transactions.
- Paid write: create or rotate a Session. Use a unique `idempotency_key` and owner approval.
- Policy write: change API-Key and daily budget limits. Require owner approval.
- Cleanup: terminate a Session when the task ends. Early termination does not imply a refund.

`nexalayer_list_products` returns a compact, paginated catalog. It defaults to 20 currently available products per page, omits zero-stock static products, and excludes internal pricing and supplier fields. Set `available_only` to `false` only when unavailable products are relevant.

`nexalayer_create_session` incurs charges against the account balance. Read the current quote and budget, then obtain owner approval before calling it.

Public starting prices are USD 4/GB for dynamic proxies and USD 10/month for static proxies. Always read `nexalayer_list_products` before purchase because the returned quote is authoritative.

```text
nexalayer_list_products → nexalayer_get_budget → owner approval
→ nexalayer_create_session → health/usage → nexalayer_terminate_session
```

Common API error codes include `AUTH_INVALID_KEY`, `INSUFFICIENT_BALANCE`, `BUDGET_EXCEEDED`, `IDEMPOTENCY_CONFLICT`, and `RATE_LIMIT_EXCEEDED`.

## Docker

Build the stdio MCP server from the repository root:

```bash
docker build -t nexalayer-mcp ./mcp
```

The container can start and expose its tool catalog without credentials, which allows MCP directories and clients to inspect it safely:

```bash
docker run -i --rm nexalayer-mcp
```

Pass the API Key only at runtime when calling NexaLayer tools:

```bash
docker run -i --rm \
  -e NEXALAYER_API_KEY="$NEXALAYER_API_KEY" \
  nexalayer-mcp
```

`NEXALAYER_BASE_URL` remains optional. The image uses stdio and does not expose a network port or contain credentials.

Request an API key and one-time trial credit at https://nexalayer.net/agents?source=mcp-readme.
