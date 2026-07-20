import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSessionSchema } from '../../src/modules/session/session.schema';
import { rechargeSchema } from '../../src/modules/billing/billing.schema';
import { shouldReleaseStaticResource } from '../../src/modules/session/session-lifecycle';
import {
  toBackendDynamicProductNo,
  toPublicDynamicProductNo,
} from '../../src/gateway/dynamic-product';

describe('trial resource contract', () => {
  it('accepts USD recharge amounts with a $10 minimum', () => {
    expect(
      rechargeSchema.parse({ amount_usd: 10 }).amount_usd
    ).toBe(10);
    expect(() =>
      rechargeSchema.parse({ amount_usd: 9.99 })
    ).toThrow();
  });
  it('keeps purchase as the backward-compatible default', () => {
    const parsed = createSessionSchema.parse({
      session_type: 'dynamic',
      product_no: 'dynamic_dyn3',
    });
    expect(parsed.provisioning_mode).toBe('purchase');
  });

  it('accepts an existing resource without requiring a resource id', () => {
    const parsed = createSessionSchema.parse({
      session_type: 'static',
      product_no: 'static_resource6',
      provisioning_mode: 'existing',
    });
    expect(parsed.provisioning_mode).toBe('existing');
    expect(parsed.resource_id).toBeUndefined();
  });

  it('never releases an existing static resource on Session terminate', () => {
    expect(
      shouldReleaseStaticResource({
        sessionType: 'static',
        provisioningMode: 'existing',
        backendOrderNo: 'ZT_TEST_ORDER',
        status: 'active',
      })
    ).toBe(false);
  });

  it('still releases a NexaLayer-purchased static resource', () => {
    expect(
      shouldReleaseStaticResource({
        sessionType: 'static',
        provisioningMode: 'purchase',
        backendOrderNo: 'ZT_TEST_ORDER',
        status: 'active',
      })
    ).toBe(true);
  });

  it('exposes only the supported DYN3 product with a supplier-neutral id', () => {
    expect(toPublicDynamicProductNo('dynamic_ipweb')).toBe('dynamic_dyn3');
    expect(toPublicDynamicProductNo('dynamic_dyn3')).toBe('dynamic_dyn3');
    expect(toBackendDynamicProductNo('dynamic_dyn3')).toBe('dynamic_ipweb');
    expect(toPublicDynamicProductNo('out_dynamic_1')).toBeNull();
    expect(toPublicDynamicProductNo('out_dynamic_ipweb')).toBeNull();
  });

  it('never performs a second local wallet debit for Session purchases', () => {
    const source = readFileSync(
      new URL('../../src/modules/session/session.service.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('reserveSessionCharge');
    expect(source).not.toContain('captureSessionReservation');
    expect(source).not.toContain('releaseSessionReservation');
  });
});
