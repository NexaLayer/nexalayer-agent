import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDENTIALS_NOTE = 'Credentials are omitted unless include_credentials=true; never log them.';

test('stdio tools pass include_credentials and describe credential handling', async () => {
  /** @type {{ method: string | undefined, url: string | undefined, body: string }[]} */
  const hits = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    hits.push({
      method: req.method,
      url: req.url,
      body: Buffer.concat(chunks).toString('utf8'),
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { seen: req.url } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry) => entry[1] !== undefined),
  );
  env.NEXALAYER_API_KEY = 'agk_test';
  env.NEXALAYER_BASE_URL = `http://127.0.0.1:${address.port}`;

  const client = new Client({ name: 'mcp-credentials-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: root,
    env,
    stderr: 'pipe',
  }));

  try {
    const listed = await client.listTools();
    const tools = new Map(listed.tools.map((tool) => [tool.name, tool]));
    assert.equal(tools.size, 12);

    const create = tools.get('nexalayer_create_session');
    const getSession = tools.get('nexalayer_get_session');
    const rotate = tools.get('nexalayer_rotate_session');
    assert.ok(create && getSession && rotate);

    assert.match(create.description, /does not honor include_credentials/);
    assert.match(create.description, /PRICE_MISMATCH \(409: re-read prices, retry once\)/);
    assert.match(
      create.description,
      /BUDGET_EXCEEDED and INSUFFICIENT_BALANCE \(402: ask the owner, don't retry\)/,
    );
    for (const tool of [create, getSession, rotate]) {
      assert.match(tool.description, new RegExp(CREDENTIALS_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.equal(create.inputSchema.properties?.include_credentials, undefined);
    for (const tool of [getSession, rotate]) {
      assert.equal(tool.inputSchema.properties?.include_credentials?.type, 'boolean');
      assert.equal(tool.inputSchema.properties?.include_credentials?.default, false);
    }

    await client.callTool({
      name: 'nexalayer_get_session',
      arguments: { session_id: 'ses/1', include_credentials: true },
    });
    await client.callTool({
      name: 'nexalayer_get_session',
      arguments: { session_id: 'ses/1' },
    });
    await client.callTool({
      name: 'nexalayer_rotate_session',
      arguments: {
        session_id: 'ses 1',
        include_credentials: true,
        idempotency_key: 'rotate-1',
        reason: 'timeout',
      },
    });
    await client.callTool({
      name: 'nexalayer_create_session',
      arguments: {
        session_type: 'dynamic',
        product_no: 'dynamic_2',
        idempotency_key: 'create-1',
      },
    });

    assert.deepEqual(hits.map((hit) => `${hit.method} ${hit.url}`), [
      'GET /sessions/ses%2F1?include_credentials=true',
      'GET /sessions/ses%2F1?include_credentials=false',
      'POST /sessions/ses%201/rotate?include_credentials=true',
      'POST /sessions',
    ]);
    assert.equal(JSON.parse(hits[2].body).reason, 'timeout');
    const created = JSON.parse(hits[3].body);
    assert.equal(created.include_credentials, undefined);
    assert.equal(created.product_no, 'dynamic_2');
    assert.equal(hits[3].body.includes('include_credentials'), false);
  } finally {
    await client.close();
    server.closeAllConnections?.();
    server.close();
    await once(server, 'close');
  }
});
