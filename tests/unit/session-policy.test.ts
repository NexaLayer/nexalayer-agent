import { describe, expect, it } from 'vitest';
import {
  assertPriceMatches,
  assertProjectSelection,
  assertProtocolSupported,
  canonicalStaticCity,
  staticMonths,
  transactionDebitCny,
} from '../../src/modules/session/session-policy';

describe('session purchase safety policy', () => {
  it('rejects an upstream price above the displayed AgentPrice before purchase', () => {
    expect(() => assertPriceMatches(5, 33)).toThrowError(expect.objectContaining({ code: 'PRICE_MISMATCH' }));
    expect(() => assertPriceMatches(5, 5)).not.toThrow();
  });

  it('requires a valid project when the product declares projects', () => {
    expect(() => assertProjectSelection(true, ['p1'], undefined)).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    expect(() => assertProjectSelection(true, ['p1'], 'bad')).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    expect(() => assertProjectSelection(true, ['p1'], 'p1')).not.toThrow();
  });

  it('rejects unsupported static protocols', () => {
    expect(() => assertProtocolSupported('static', 'http')).toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    expect(() => assertProtocolSupported('static', 'socks5')).not.toThrow();
  });

  it('derives actual spend from the matching transaction and duration from months', () => {
    expect(transactionDebitCny([{ order_no: 'STA1', amount: -33 }], 'STA1')).toBe(33);
    expect(transactionDebitCny([{ order_no: 'STA2', amount: -33 }], 'STA1')).toBeNull();
    expect(staticMonths(30)).toBe(1);
    expect(staticMonths(31)).toBe(2);
  });

  it('uses the ZT product number as the canonical city', () => {
    expect(canonicalStaticCity('ZT_US_Englewood_5', 'LOS_ANGELES')).toBe('ENGLEWOOD');
  });
});
