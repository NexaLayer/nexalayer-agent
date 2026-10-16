import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerTolerantJsonParser } from '../../src/middleware/json-parser';

describe('tolerant JSON parser', () => {
  it('allows a DELETE request with JSON Content-Type and no body', async () => {
    const app = Fastify();
    registerTolerantJsonParser(app);
    app.delete('/sessions/:id', async () => ({ ok: true }));

    const response = await app.inject({
      method: 'DELETE',
      url: '/sessions/ses_1',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it('still parses valid JSON and rejects malformed JSON', async () => {
    const app = Fastify();
    registerTolerantJsonParser(app);
    app.post('/echo', async (request) => request.body);

    const valid = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"ok":true}',
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    expect(valid.json()).toEqual({ ok: true });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });
});
