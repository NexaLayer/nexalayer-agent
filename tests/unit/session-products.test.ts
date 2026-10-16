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
});
