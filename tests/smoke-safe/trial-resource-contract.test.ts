import { describe, expect, it } from 'vitest';
import { createSessionSchema } from '../../src/modules/session/session.schema';
import { shouldReleaseStaticResource } from '../../src/modules/session/session-lifecycle';
import { toPublicDynamicProductNo } from '../../src/gateway/dynamic-product';

describe('trial resource contract', () => {
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
    expect(toPublicDynamicProductNo('out_dynamic_1')).toBeNull();
    expect(toPublicDynamicProductNo('out_dynamic_ipweb')).toBeNull();
  });
});
