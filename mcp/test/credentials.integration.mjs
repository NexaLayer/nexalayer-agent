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
    assert.equal(tools.size, 16);

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

test('support tools: structured errors, auto-attached request ids, public status', async () => {
  /** @type {{ method: string | undefined, url: string | undefined, body: string, key: string | undefined }[]} */
  const hits = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    hits.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8'), key: req.headers['x-api-key'] });
    if (req.url?.startsWith('/sessions/ses_fail')) {
      res.writeHead(503, { 'content-type': 'application/json', 'x-request-id': 'req_fail1' });
      res.end(JSON.stringify({
        success: false,
        data: null,
        error: { code: 'UPSTREAM_UNAVAILABLE', message: 'upstream down', status: 503, retryable: true, retry_after: 60, suggested_action: 'check_status', doc_url: 'https://api.nexalayer.net/v1/public/errors/UPSTREAM_UNAVAILABLE', known_issue_id: null },
        meta: { request_id: 'req_fail1' },
      }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { seen: req.url }, meta: { request_id: 'req_ok1' } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const env = Object.fromEntries(Object.entries(process.env).filter((entry) => entry[1] !== undefined));
  env.NEXALAYER_API_KEY = 'agk_test';
  env.NEXALAYER_BASE_URL = `http://127.0.0.1:${address.port}`;
  const client = new Client({ name: 'mcp-support-test', version: '1.2.3' });
  await client.connect(new StdioClientTransport({ command: 'node', args: ['dist/index.js'], cwd: root, env, stderr: 'pipe' }));
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    for (const name of ['nexalayer_report_issue', 'nexalayer_get_ticket', 'nexalayer_check_status', 'nexalayer_known_issues']) {
      assert.ok(names.includes(name), name);
    }
    const failed = await client.callTool({ name: 'nexalayer_session_health', arguments: { session_id: 'ses_fail' } });
    assert.equal(failed.isError, true);
    assert.equal(failed.structuredContent.error.code, 'UPSTREAM_UNAVAILABLE');
    assert.equal(failed.structuredContent.request_id, 'req_fail1');
    assert.match(failed.content[0].text, /Action: check_status/);

    await client.callTool({ name: 'nexalayer_check_status', arguments: {} });
    await client.callTool({ name: 'nexalayer_known_issues', arguments: { error_code: 'UPSTREAM_UNAVAILABLE' } });
    await client.callTool({ name: 'nexalayer_report_issue', arguments: { category: 'bug', summary: 'health 503', tool: 'nexalayer_session_health', idempotency_key: 'tkt-1' } });
    await client.callTool({ name: 'nexalayer_get_ticket', arguments: { ticket_id: 'tkt_abc123' } });

    const urls = hits.map((h) => `${h.method} ${h.url}`);
    assert.deepEqual(urls, [
      'GET /sessions/ses_fail/health',
      'GET /public/status',
      'GET /public/known-issues?status=open&error_code=UPSTREAM_UNAVAILABLE',
      'POST /support/tickets',
      'GET /support/tickets/tkt_abc123',
    ]);
    assert.equal(hits[1].key, undefined, 'public status is called without the API key');
    const ticket = JSON.parse(hits[3].body);
    assert.deepEqual(ticket.request_ids, ['req_fail1']);
    assert.deepEqual(ticket.error_codes, ['UPSTREAM_UNAVAILABLE']);
    assert.equal(ticket.client.via, 'mcp');
    assert.equal(ticket.client.sdk_or_mcp_version, '@nexalayer/mcp@0.2.0');
    assert.equal(ticket.client.mcp_client, 'mcp-support-test@1.2.3');
    assert.equal(ticket.reproduction.endpoint_or_tool, 'nexalayer_session_health');
  } finally {
    await client.close();
    server.closeAllConnections?.();
    server.close();
    await once(server, 'close');
  }
});
