import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const getUserIdentity = vi.fn();
const getUsdtRate = vi.fn();
const getDynamicProducts = vi.fn();
const getStaticProducts = vi.fn();
const getAgentProductPrices = vi.fn();

vi.mock('../../src/app', () => ({
  prisma: { agentApp: { findUnique } },
}));
vi.mock('../../src/config/env', () => ({
  env: {
    PRICING_AGENT_APP_ID: 139,
    PRICING_OWNER_AGENT_ID: 1474,
    NEXALAYER_DYNAMIC_PRICE_CNY: 1.5,
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
  getAgentProductPrices,
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
      { id: 1, type: 'DYN-1', name: 'Dynamic Proxy', proxyType: 104, price: 28, flow: 10, country: 'US', city: '' },
      { id: 2, type: 'DYN-EMPTY', name: 'Empty Dynamic', proxyType: 104, price: 28, flow: 0, country: 'US', city: '' },
    ]);
    getStaticProducts.mockResolvedValue([
      { id: 0, productId: 'STATIC-SHARED', proxyType: 103, productType: 2, price: 70, stock: 2, status: 1, country: 'US', city: 'New York' },
      { id: 0, productId: 'INTERNAL-NO-PRICE', proxyType: 103, productType: 1, price: 999, stock: 2, status: 1, country: 'US', city: 'Internal' },
    ]);
    getAgentProductPrices.mockResolvedValue([
      { id: 1, type: 'dynamic', price: 1.5, costPrice: 0, globalPrice: 15 },
      { id: 2, type: 'dynamic', price: 1.5, costPrice: 0, globalPrice: 15 },
      { id: 201, type: 'STATIC-SHARED', price: 5, costPrice: 0, globalPrice: 70 },
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
    expect(first.items.every((item) => /^[\x20-\x7E]+$/.test(item.name))).toBe(true);
  });

  it('keeps dynamic products purchasable and applies filters/cursors', async () => {
    const service = await import('../../src/modules/product/product.service');
    const all = await service.listProducts({ type: 'dynamic', in_stock: false, limit: 20 });
    expect(all.items.find((item) => item.product_no === 'DYN-EMPTY')?.available).toBe(true);
    expect(getStaticProducts).not.toHaveBeenCalled();
    expect(getAgentProductPrices).not.toHaveBeenCalled();
    const available = await service.listProducts({ type: 'all', country: 'US', in_stock: true, limit: 1 });
    expect(available.items).toHaveLength(1);
    expect(available.next_cursor).not.toBeNull();
    expect(available.items[0]).toMatchObject({ sharing: 'shared', available: true, price: 0.21 });
    expect(available.items.every((item) => /^[\x20-\x7E]+$/.test(item.name))).toBe(true);
  });

  it('uses openAgent prices rather than the ordinary pricing-account prices', async () => {
    const service = await import('../../src/modules/product/product.service');
    const result = await service.listProducts({ type: 'all', in_stock: true, limit: 20 });
    expect(getAgentProductPrices).toHaveBeenCalledWith(1474, [103]);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_no: 'DYN-1', price: 0.21 }),
      expect.objectContaining({ product_no: 'STATIC-SHARED', sharing: 'shared', price: 0.71 }),
    ]));
    expect(result.items.some((item) => item.product_no === 'INTERNAL-NO-PRICE')).toBe(false);
  });

  it('whitelists public fields and does not expose internal pricing metadata', async () => {
    const service = await import('../../src/modules/product/product.service');
    const result = await service.listPublicProducts({ type: 'static', in_stock: true, limit: 20 });
    expect(result).not.toHaveProperty('pricing_owner_agent_id');
    expect(result.items[0]).not.toHaveProperty('proxy_type');
    expect(result.items[0]).not.toHaveProperty('product_type');
    expect(result.items[0]).not.toHaveProperty('projects');
    expect(result.items[0]).not.toHaveProperty('project_required');
  });

  it('uses the ZT product number as the canonical location label', async () => {
    getStaticProducts.mockResolvedValueOnce([
      { id: 0, productId: 'ZT_US_Englewood_5', proxyType: 103, productType: 2, price: 70, stock: 2, status: 1, country: 'US', city: 'LOS_ANGELES' },
    ]);
    getAgentProductPrices.mockResolvedValueOnce([
      { id: 201, type: 'ZT_US_Englewood_5', price: 5, costPrice: 0, globalPrice: 70 },
    ]);
    const service = await import('../../src/modules/product/product.service');
    const result = await service.listProducts({ type: 'static', in_stock: true, limit: 20 });
    expect(result.items[0]).toMatchObject({
      product_no: 'ZT_US_Englewood_5',
      name: 'ENGLEWOOD, US Shared Static Proxy',
    });
  });
});
