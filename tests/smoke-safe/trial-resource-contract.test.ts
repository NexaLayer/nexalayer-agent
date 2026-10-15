import { describe, expect, it } from 'vitest';
import { getPublicPricing } from '../../src/modules/product/public-pricing';
import { readFileSync } from 'node:fs';
import { createSessionSchema } from '../../src/modules/session/session.schema';
import { rechargeSchema } from '../../src/modules/billing/billing.schema';
import { updateBudgetSchema } from '../../src/modules/account/account.schema';
import { shouldReleaseStaticResource } from '../../src/modules/session/session-lifecycle';
import {
  dynamicProductName,
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
    expect(() =>
      rechargeSchema.parse({ amount_usd: 10.001 })
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
    expect(toPublicDynamicProductNo('out_dynamic_ipweb')).toBe('dynamic_2');
    expect(toPublicDynamicProductNo('dynamic_2')).toBe('dynamic_2');
    expect(toBackendDynamicProductNo('dynamic_2')).toBe('out_dynamic_ipweb');
    expect(dynamicProductName('dynamic_2')).toBe('Dynamic Proxy Pool 2');
    expect(dynamicProductName('dynamic_dyn3')).toBe('Dynamic Proxy Pool 3');
    expect(toPublicDynamicProductNo('out_dynamic_1')).toBeNull();
  });

  it('does not synthesize disabled dynamic products', () => {
    const source = readFileSync(
      new URL('../../src/gateway/backend-client.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('return items.flatMap((p) =>');
    expect(source).not.toContain("PUBLIC_DYN3_PRODUCT_NO,");
    expect(source).not.toContain("type: 'dynamic_dyn3'");
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

  it('accepts bounded key and daily spend policies', () => {
    const policy = updateBudgetSchema.parse({
      key_limit_usd: 50,
      daily_limit_usd: 10,
      pause_on_exceed: true,
      alert_thresholds: [50, 80, 100],
    });
    expect(policy.daily_limit_usd).toBe(10);
    expect(policy.pause_on_exceed).toBe(true);
  });

  it('serializes simultaneous budget reservations for one key', () => {
    const source = readFileSync(
      new URL('../../src/modules/account/budget.service.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('projected_daily_spend_usd');
  });

  it('grants trial credit only on first email-account creation', () => {
    const source = readFileSync(
      new URL('../../src/modules/account/account.service.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('trialBalanceUsd = env.TRIAL_BALANCE');
    expect(source).toContain('agentTrialClaim.create');
    expect(source.indexOf('existingIdentity')).toBeLessThan(
      source.indexOf('trialBalanceUsd = env.TRIAL_BALANCE')
    );
  });

  it('publishes unauthenticated starting prices', () => {
    const pricingSource = readFileSync(
      new URL('../../src/modules/product/public-pricing.ts', import.meta.url),
      'utf8'
    );
    const pricing = JSON.parse(
      readFileSync('src/config/public-pricing.json', 'utf8')
    );
    expect(pricingSource).toContain('currency: pricing.currency');
    expect(pricingSource).toContain('pricing.products.dynamic.unit');
    expect(pricingSource).toContain('pricing.products.static.unit');
    expect(pricing.currency).toBe('USD');
    expect(pricing.products.dynamic.unit).toBe('GB');
    expect(pricing.products.static.unit).toBe('month');
    expect(pricing.products.dynamic.starting_price).toBe(4);
    expect(pricing.products.static.starting_price).toBe(10);
    expect(readFileSync('openapi/openapi.yaml', 'utf8')).toContain(
      '/public/products:'
    );
  });

  it('exposes only the public pricing field allowlist', () => {
    const response = getPublicPricing();
    expect(Object.keys(response).sort()).toEqual(
      ['currency', 'exact_pricing_url', 'items', 'updated_at'].sort()
    );
    expect(response.items).toHaveLength(2);
    for (const item of response.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['name', 'price_qualifier', 'starting_price', 'type', 'unit'].sort()
      );
      expect(item).not.toHaveProperty('product_no');
      expect(item).not.toHaveProperty('supplier');
      expect(item).not.toHaveProperty('cost');
      expect(item).not.toHaveProperty('stock');
      expect(item).not.toHaveProperty('projects');
      expect(item).not.toHaveProperty('product_type');
    }
    expect(response.items.map((item) => item.type).sort()).toEqual([
      'dynamic',
      'static',
    ]);
  });

  it('guards automatic trial credit by email provider, IP, and installation', () => {
    const source = readFileSync(
      new URL('../../src/modules/account/account.service.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('DEFAULT_DISPOSABLE_EMAIL_DOMAINS');
    expect(source).toContain('TRIAL_MAX_CLAIMS_PER_IP_PER_DAY');
    expect(source).toContain('TRIAL_MAX_CLAIMS_PER_DEVICE');
    expect(source).toContain("createHmac('sha256', env.ENCRYPTION_KEY)");
  });

  it('calibrates trial credit and alerts operators on claim surges', () => {
    const envSource = readFileSync('src/config/env.ts', 'utf8');
    const monitorSource = readFileSync(
      'src/modules/account/trial-monitor.service.ts',
      'utf8'
    );
    expect(envSource).toContain('TRIAL_BALANCE: z.coerce.number().positive().default(5.0)');
    expect(monitorSource).toContain("event: 'TRIAL_CLAIM_SURGE'");
    expect(monitorSource).toContain('TRIAL_ALERT_WEBHOOK_URL');
    expect(monitorSource).toContain('TRIAL_ALERT_TELEGRAM_BOT_TOKEN');
    expect(monitorSource).toContain('TRIAL_ALERT_TELEGRAM_CHAT_ID');
    expect(monitorSource).toContain('api.telegram.org');
    expect(monitorSource).toContain('agentTrialClaim.count');
  });
});
