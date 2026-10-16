import { describe, expect, it, vi } from 'vitest';

const terminateSession = vi.fn();
vi.mock('../../src/modules/session/session.service', () => ({ terminateSession }));

describe('DELETE /v1/sessions/:id controller', () => {
  it('does not require a body or Content-Type header', async () => {
    terminateSession.mockResolvedValue({ session_id: 'ses_1', status: 'terminated' });
    const { handleTerminate } = await import('../../src/modules/session/session.controller');
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const request = {
      agentContext: { agentId: 7 },
      params: { session_id: 'ses_1' },
      headers: {},
      body: undefined,
      startTime: Date.now(),
    };
    await handleTerminate(request as never, { status } as never);
    expect(terminateSession).toHaveBeenCalledWith(7, 'ses_1');
    expect(status).toHaveBeenCalledWith(200);
  });
});
