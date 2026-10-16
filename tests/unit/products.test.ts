import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const getUserIdentity = vi.fn();
const getUsdtRate = vi.fn();
const getDynamicProducts = vi.fn();
const getStaticProducts = vi.fn();

vi.mock('../../src/app', () => ({
  prisma: { agentApp: { findUnique } },
}));
vi.mock('../../src/config/env', () => ({
  env: {
    PRICING_AGENT_APP_ID: 139,
    PRICING_OWNER_AGENT_ID: 1474,
    PRODUCT_CACHE_TTL_SECONDS: 60,
  },
}));
vi.mock('../../src/utils/crypto', () => ({ decrypt: () => 'password' }));
vi.mock('../../src/gateway/backend-client', () => ({
  getUserIdentity,
  getBackendUserOwner: vi.fn(),
  getUsdtRate,
  getDynamicProducts,
  getStaticProducts,
  getAreaHierarchy: vi.fn(),
}));

describe('openAgent product catalog', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const service = await import('../../src/modules/product/product.service');
    service.clearProductCacheForTests();
    findUnique.mockResolvedValue({ backendUsername: 'pricing', backendPasswordEnc: 'encrypted' });
    getUserIdentity.mockResolvedValue({ token: 'token', agentId: 1474 });
    getUsdtRate.mockResolvedValue({ effective_rate: 7 });
    getDynamicProducts.mockResolvedValue([
      { type: 'DYN-1', name: 'Dynamic Proxy', proxyType: 104, price: 28, flow: 10, country: 'US', city: '' },
      { type: 'DYN-EMPTY', name: 'Empty Dynamic', proxyType: 104, price: 28, flow: 0, country: 'US', city: '' },
    ]);
    getStaticProducts.mockResolvedValue([
      { productId: 'S-1', proxyType: 103, productType: 1, price: 70, stock: 2, status: 1, country: 'US', city: 'NYC' },
    ]);
  });

  it('uses AgentApp 139 owned by openAgent 1474 and caches upstream reads for 60s', async () => {
    const service = await import('../../src/modules/product/product.service');
    const query = { type: 'all' as const, in_stock: true, limit: 20 };
    const first = await service.listProducts(query);
    const second = await service.listProducts(query);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 139 } });
    expect(getUserIdentity).toHaveBeenCalledTimes(1);
    expect(getDynamicProducts).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.pricing_owner_agent_id).toBe(1474);
    expect(first.cache_ttl_seconds).toBe(60);
  });

  it('marks zero-flow dynamic products unavailable and applies filters/cursors', async () => {
    const service = await import('../../src/modules/product/product.service');
    const all = await service.listProducts({ type: 'dynamic', in_stock: false, limit: 20 });
    expect(all.items.find((item) => item.product_no === 'DYN-EMPTY')?.available).toBe(false);
    const available = await service.listProducts({ type: 'all', country: 'US', in_stock: true, limit: 1 });
    expect(available.items).toHaveLength(1);
    expect(available.next_cursor).not.toBeNull();
    expect(available.items[0]).toMatchObject({ sharing: 'shared', available: true, price: 4 });
  });
});
