import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { listProductsSchema } from '../../src/modules/product/product.schema';
import { HTTP_STATUS_FOR_ERROR, ERROR_CODES } from '../../src/config/constants';

const root = resolve(__dirname, '../..');

describe('public API and MCP contracts', () => {
  it('defaults product discovery to in-stock and 20 items with cursor filters', () => {
    expect(listProductsSchema.parse({})).toEqual({ type: 'all', in_stock: true, limit: 20 });
    expect(listProductsSchema.parse({ type: 'dynamic', country: 'US', in_stock: 'false', limit: '10', cursor: 'MTA' }))
      .toMatchObject({ type: 'dynamic', country: 'US', in_stock: false, limit: 10, cursor: 'MTA' });
  });

  it('rejects budget excess without a conflict status', () => {
    expect([402, 422]).toContain(HTTP_STATUS_FOR_ERROR[ERROR_CODES.BUDGET_EXCEEDED]);
    const source = readFileSync(resolve(root, 'src/modules/account/budget.service.ts'), 'utf8');
    expect(source).not.toContain('pauseReason: reason');
  });

  it('does not expose plaintext keys and refunds failed provisioning charges', () => {
    const account = readFileSync(resolve(root, 'src/modules/account/account.service.ts'), 'utf8');
    const session = readFileSync(resolve(root, 'src/modules/session/session.service.ts'), 'utf8');
    const accountInfo = account.slice(
      account.indexOf('export async function getAgentInfo'),
      account.indexOf('export async function requestEmailLoginCode')
    );
    expect(account).toContain('api_key_prefix: maskApiKey(agent.apiKey)');
    expect(accountInfo).not.toContain('api_key: agent.apiKey');
    expect(session).toContain('assertPriceMatches(price, match.price)');
    expect(session).toContain('refundUserBalance');
    expect(session).toContain('estimatedChargeUsd: refundedCny > 0 ? 0 : undefined');
  });

  it('documents shared/exclusive availability and charged MCP creation', () => {
    const mcp = readFileSync(resolve(root, 'mcp/src/index.ts'), 'utf8');
    expect(mcp).toContain("'sharing', 'available'");
    expect(mcp).toContain('limit: z.number().int().min(1).max(100).default(20)');
    expect(mcp).toMatch(/create_session[\s\S]+incurs charges/);
  });

  it('uses the Error schema for reusable OpenAPI errors', () => {
    const spec = readFileSync(resolve(root, 'openapi/openapi.yaml'), 'utf8');
    expect(spec).toContain('/sessions/{session_id}/usage');
    expect(spec).toContain('Error:');
    expect(spec).toContain('error: { $ref: "#/components/schemas/Error" }');
    for (const name of ['BadRequest', 'Unauthorized', 'NotFound', 'InsufficientBalance', 'Conflict', 'RateLimited', 'Unprocessable']) {
      expect(spec).toMatch(new RegExp(`${name}:[\\s\\S]*?ErrorResponse`));
    }
  });
});
