# NexaLayer MCP Server

This directory contains the MCP server package and implementation. For the repository overview, installation options, complete 12-tool catalog, and backend relationship, see the [root README](../README.md).

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

- Read: products and exact prices, session detail, health, usage, budget, alerts, balance, and transactions.
- Paid write: create or rotate a Session. Use a unique `idempotency_key` and owner approval.
- Policy write: change API-Key and daily budget limits. Require owner approval.
- Cleanup: terminate a Session when the task ends. Early termination does not imply a refund.

`nexalayer_list_products` returns a compact, cursor-paginated catalog. It defaults to 20 currently available products, supports `type`, `country`, `in_stock`, `limit`, and `cursor`, and excludes internal pricing and supplier fields.

`nexalayer_create_session` incurs charges against the account balance. Read the current quote and budget, then obtain owner approval before calling it. `POST /sessions` does not honor `include_credentials` and omits proxy credentials. `PRICE_MISMATCH` (409): re-read prices, retry once. `BUDGET_EXCEEDED` and `INSUFFICIENT_BALANCE` (402): ask the owner, don't retry.

`nexalayer_get_session` and `nexalayer_rotate_session` accept optional `include_credentials` (default `false`) and pass it to the API. Credentials are omitted unless `include_credentials=true`; never log them.

Always read `nexalayer_list_products` before purchase because it returns the current openAgent-backed quote and availability. Exclusive static proxy sessions are **$1.43–$5.86/month** (launch pricing, live API authoritative).

```text
nexalayer_list_products → nexalayer_get_budget → owner approval
→ nexalayer_create_session → nexalayer_get_session → health/usage → nexalayer_terminate_session
```

Common API error codes include `AUTH_INVALID_KEY`, `INSUFFICIENT_BALANCE`, `BUDGET_EXCEEDED`, `PRICE_MISMATCH`, `IDEMPOTENCY_CONFLICT`, and `RATE_LIMIT_EXCEEDED`.

`PRICE_MISMATCH` is HTTP 409: re-read prices, retry once. `BUDGET_EXCEEDED` and `INSUFFICIENT_BALANCE` are HTTP 402: ask the owner, don't retry.

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
