# NexaLayer MCP Server

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

The server writes protocol messages only to stdout. API errors go through MCP tool results. Paid session creation and budget changes should remain subject to the owner's approval policy.

Request an API key and one-time trial credit at https://nexalayer.net/agents?source=mcp-readme.
