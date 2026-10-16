import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDynamicProducts = vi.fn();
const getStaticProducts = vi.fn();
vi.mock('../../src/app', () => ({ prisma: {} }));
vi.mock('../../src/utils/crypto', () => ({ encrypt: vi.fn(), decrypt: vi.fn() }));
vi.mock('../../src/gateway/backend-client', () => ({ getDynamicProducts, getStaticProducts }));
vi.mock('../../src/modules/product/agent-pricing', () => ({
  getOpenAgentDynamicPrice: () => 1.5,
  getOpenAgentPriceMap: vi.fn(),
  resolveOpenAgentPrice: vi.fn(),
}));

describe('session product lookup errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns PRODUCT_NOT_FOUND for an unknown dynamic product', async () => {
    getDynamicProducts.mockResolvedValue([]);
    const { lookupProductInfo } = await import('../../src/modules/session/session.service');
    await expect(lookupProductInfo('token', 'missing', 'dynamic')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('returns PRODUCT_NOT_FOUND for an unknown static product', async () => {
    getStaticProducts.mockResolvedValue([]);
    const { lookupProductInfo } = await import('../../src/modules/session/session.service');
    await expect(lookupProductInfo('token', 'missing', 'static')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('accepts dynamic inventory with stock even when flow is zero', async () => {
    getDynamicProducts.mockResolvedValue([
      { type: 'dynamic_2', backendProductNo: 'out_dynamic_ipweb', proxyType: 104, price: 1.5, flow: 0, stock: 1000, duration: 30, unit: 1 },
    ]);
    const { lookupProductInfo } = await import('../../src/modules/session/session.service');
    await expect(lookupProductInfo('token', 'dynamic_2', 'dynamic')).resolves.toMatchObject({
      backendProductNo: 'out_dynamic_ipweb',
      price: 1.5,
      stock: 1000,
    });
  });

  it('rejects dynamic inventory with zero stock even when flow is positive', async () => {
    getDynamicProducts.mockResolvedValue([
      { type: 'dynamic_2', backendProductNo: 'out_dynamic_ipweb', proxyType: 104, price: 1.5, flow: 1000, stock: 0, duration: 30, unit: 1 },
    ]);
    const { lookupProductInfo } = await import('../../src/modules/session/session.service');
    await expect(lookupProductInfo('token', 'dynamic_2', 'dynamic')).rejects.toMatchObject({
      code: 'PRODUCT_OUT_OF_STOCK',
    });
  });

  it('rejects dynamic purchase when upstream would charge more than the advertised price', async () => {
    getDynamicProducts.mockResolvedValue([
      { type: 'dynamic_2', backendProductNo: 'out_dynamic_ipweb', proxyType: 104, price: 15, flow: 0, stock: 1000, duration: 30, unit: 1 },
    ]);
    const { lookupProductInfo } = await import('../../src/modules/session/session.service');
    await expect(lookupProductInfo('token', 'dynamic_2', 'dynamic')).rejects.toMatchObject({
      code: 'PRICE_MISMATCH',
    });
  });
});
