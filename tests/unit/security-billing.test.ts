import { describe, expect, it } from 'vitest';
import { maskApiKey } from '../../src/utils/api-key';
import { refundableCharge } from '../../src/utils/billing';
import { hashIdempotentRequest, parseResponsePayload } from '../../src/utils/idempotency';

describe('account and billing safety contracts', () => {
  it('returns only a masked API key prefix', () => {
    expect(maskApiKey('nx_abcdefghijklmnop')).toBe('nx_abcd…mnop');
    expect(maskApiKey('nx_abcdefghijklmnop')).not.toContain('efghijkl');
  });

  it('refunds only the observed upstream balance deduction', () => {
    expect(refundableCharge(100, 96.235)).toBe(3.77);
    expect(refundableCharge(100, 101)).toBe(0);
  });

  it('hashes canonical request bodies and detects body conflicts', () => {
    const first = hashIdempotentRequest({ method: 'post', url: '/v1/sessions', body: { a: 1, b: 2 } });
    const reordered = hashIdempotentRequest({ method: 'POST', url: '/v1/sessions', body: { b: 2, a: 1 } });
    const changed = hashIdempotentRequest({ method: 'POST', url: '/v1/sessions', body: { a: 1, b: 3 } });
    expect(first).toBe(reordered);
    expect(changed).not.toBe(first);
  });

  it('persists the complete JSON response when Fastify sends a Buffer', () => {
    const response = { success: true, data: { session_id: 'ses_1', billing: { estimated_charge_usd: 2 } } };
    expect(parseResponsePayload(Buffer.from(JSON.stringify(response)))).toEqual(response);
  });
});
