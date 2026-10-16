import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionFindFirst = vi.fn();
const agentFindUnique = vi.fn();
const getUserToken = vi.fn();
const getDynamicResourceUsage = vi.fn();

vi.mock('../../src/app', () => ({
  prisma: {
    agentSession: { findFirst: sessionFindFirst },
    agentApp: { findUnique: agentFindUnique },
  },
}));
vi.mock('../../src/utils/crypto', () => ({
  decrypt: () => 'password',
  encrypt: vi.fn(),
}));
vi.mock('../../src/gateway/backend-client', () => ({
  getUserToken,
  getDynamicResourceUsage,
}));
vi.mock('../../src/modules/product/agent-pricing', () => ({
  getOpenAgentDynamicPrice: () => 1.5,
  getOpenAgentPriceMap: vi.fn(),
  resolveOpenAgentPrice: vi.fn(),
}));

describe('session usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionFindFirst.mockResolvedValue({
      sessionId: 'ses_1',
      sessionType: 'dynamic',
      backendProductNo: 'dynamic_2',
      bytesUsed: 512n,
      requestsCount: 3,
      createdAt: new Date('2026-10-17T00:00:00Z'),
      expiresAt: null,
    });
    agentFindUnique.mockResolvedValue({
      backendUsername: 'user',
      backendPasswordEnc: 'encrypted',
    });
    getUserToken.mockResolvedValue('token');
    getDynamicResourceUsage.mockResolvedValue({
      total_gb: 10,
      used_gb: 2.5,
      remaining_gb: 7.5,
      today_gb: 0.5,
      current_month_gb: 2.5,
      last_month_gb: 1,
    });
  });

  it('returns live dynamic traffic with local request counters', async () => {
    const service = await import('../../src/modules/session/session.service');
    const result = await service.getSessionUsage(7, 'ses_1');
    expect(getDynamicResourceUsage).toHaveBeenCalledWith('token', 'dynamic_2');
    expect(result).toMatchObject({
      session_id: 'ses_1',
      traffic: {
        total_gb: 10,
        used_gb: 2.5,
        remaining_gb: 7.5,
        usage_percentage: 25,
        source: 'backend_account_product',
      },
      requests: { total: 3 },
      reported_bytes: 512,
    });
  });
});
