import { beforeEach, describe, expect, it, vi } from 'vitest';

const findFirst = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock('../../src/app', () => ({
  prisma: {
    agentSession: { findFirst, findUnique, update },
    agentTelemetry: { create },
  },
}));

describe('telemetry usage counters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue({ id: 9 });
    findUnique.mockResolvedValue({
      healthScore: 100,
      totalEvents: 0,
      successRate: 1,
      consecutiveFailures: 0,
    });
    create.mockResolvedValue({});
    update.mockResolvedValue({});
  });

  it('increments one request and the explicitly reported bytes', async () => {
    const service = await import('../../src/modules/telemetry/telemetry.service');
    await service.reportEvent(7, 'ses_1', {
      event_type: 'success',
      bytes_used: 1536,
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 },
      data: expect.objectContaining({
        requestsCount: { increment: 1 },
        bytesUsed: { increment: 1536n },
      }),
    }));
  });

  it('accepts request and response byte counts in metadata', async () => {
    const service = await import('../../src/modules/telemetry/telemetry.service');
    await service.reportEvent(7, 'ses_1', {
      event_type: 'success',
      metadata: { request_bytes: 100, response_bytes: 250 },
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bytesUsed: { increment: 350n },
      }),
    }));
  });
});
