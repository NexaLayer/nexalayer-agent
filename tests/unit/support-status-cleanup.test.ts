import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as any, alerts: [] as any[], release: vi.fn() }));

vi.mock('../../src/app', async () => {
  const { createFakePrisma } = await import('./helpers/fake-prisma');
  h.fake = createFakePrisma();
  const base = h.fake.prisma;
  // terminateSession also reads/updates agentSession rows.
  base.agentSession.update = async ({ where, data }: any) => Object.assign(h.fake.db.agentSession.find((s: any) => s.id === where.id), data);
  return { prisma: base };
});
vi.mock('../../src/config/env', () => ({
  env: { OPS_ALERT_DEDUPE_MINUTES: 30, STATUS_CHECK_INTERVAL_SECONDS: 60, UPSTREAM_CLEANUP_INTERVAL_SECONDS: 60, BACKEND_BASE_URL: 'http://127.0.0.1:9' },
}));
vi.mock('../../src/modules/ops/ops-alert.service', () => ({
  OPS_ALERT_EVENTS: new Proxy({}, { get: (_t, k) => String(k) }),
  sendOpsAlert: vi.fn(async (...args: unknown[]) => { h.alerts.push(args); return { deduped: false, channels: [], failures: [] }; }),
}));
vi.mock('../../src/gateway/backend-client', () => ({ releaseZtProxyStaticOrder: h.release }));
vi.mock('../../src/utils/crypto', () => ({ encrypt: (v: string) => v, decrypt: (v: string) => v }));

beforeEach(async () => {
  const status = await import('../../src/modules/support/status.service');
  status.resetStatusSignalsForTests();
  h.alerts.length = 0;
  h.fake.db.statusComponent.length = 0;
  h.fake.db.statusIncident.length = 0;
  h.fake.db.upstreamCleanupJob.length = 0;
  h.fake.db.agentSession.length = 0;
  h.release.mockReset();
});

describe('automatic component status', () => {
  it('degrades on 5xx error rate and recovers', async () => {
    const s = await import('../../src/modules/support/status.service');
    const now = Date.now();
    for (let i = 0; i < 30; i += 1) s.recordRequestOutcome('/v1/sessions/ses_1', i < 8 ? 502 : 200, now);
    expect(s.errorRateStatus('sessions', now).status).toBe('degraded_performance');
    const ok = async () => ({ reachable: true, error: '' });
    let applied = await s.runStatusChecks(ok, now);
    expect(applied.sessions).toBe('degraded_performance');
    expect(applied.api).toBe('degraded_performance'); // api aggregates all paths
    expect(h.alerts.map((a) => a[3]?.dedupeKey)).toContain('sessions:degraded_performance');

    applied = await s.runStatusChecks(ok, now + 6 * 60_000);
    expect(applied.sessions).toBe('operational');
    const status = await s.getPublicStatus();
    expect(status.incident_history.some((i: any) => i.component === 'sessions')).toBe(true);
  });

  it('marks upstream_network outage from consecutive probe failures', async () => {
    const s = await import('../../src/modules/support/status.service');
    const down = async () => ({ reachable: false, error: 'ECONNREFUSED' });
    expect((await s.runStatusChecks(down)).upstream_network).toBe('operational');
    expect((await s.runStatusChecks(down)).upstream_network).toBe('partial_outage');
    for (let i = 0; i < 3; i += 1) await s.runStatusChecks(down);
    const status = await s.getPublicStatus();
    expect(status.components.find((c: any) => c.id === 'upstream_network')?.status).toBe('major_outage');
    expect(status.indicator).toBe('major');
  });

  it('never lets auto checks override an admin override', async () => {
    const s = await import('../../src/modules/support/status.service');
    await s.setComponentStatus('billing', 'major_outage', 'admin', 'manual');
    const r = await s.setComponentStatus('billing', 'operational', 'auto', null);
    expect(r).toMatchObject({ changed: false, skipped: 'admin_override' });
    await s.setComponentStatus('billing', 'operational', 'admin', null);
    expect((await s.setComponentStatus('billing', 'degraded_performance', 'auto', 'x')).changed).toBe(true);
  });

  it('maps paths to components', async () => {
    const { componentForPath } = await import('../../src/modules/support/status.service');
    expect(componentForPath('/v1/sessions?x=1')).toBe('sessions');
    expect(componentForPath('/v1/billing/balance')).toBe('billing');
    expect(componentForPath('/v1/public/products')).toBe('catalog');
    expect(componentForPath('/v1/public/status')).toBeNull();
    expect(componentForPath('/v1/account/info')).toBe('api');
  });
});

describe('terminate during upstream outage', () => {
  const session = () => ({
    id: 10, sessionId: 'ses_static', agentId: 1, sessionType: 'static', provisioningMode: 'purchase',
    backendOrderNo: 'ORD1', status: 'active', updatedAt: new Date('2026-10-01T00:00:00Z'),
  });

  it('stops billing at the first attempt, records it, and retries in the background', async () => {
    h.fake.db.agentSession.push(session());
    h.release.mockRejectedValueOnce(new Error('upstream 502 for socks5://u:pw@h:1'));
    const { terminateSession } = await import('../../src/modules/session/session.service');
    const res: any = await terminateSession(1, 'ses_static');
    expect(res.status).toBe('terminated');
    expect(res.billing_stopped_at).toBe(res.terminated_at);
    expect(res.upstream_cleanup.status).toBe('retry_scheduled');
    expect(h.fake.db.agentSession[0].status).toBe('terminated');
    const job = h.fake.db.upstreamCleanupJob[0];
    expect(job).toMatchObject({ sessionId: 'ses_static', status: 'pending', attempts: 1 });
    expect(job.lastError).not.toContain('pw@');
    expect(h.alerts.some((a) => a[0] === 'UPSTREAM_TERMINATE_FAILED')).toBe(true);

    // A repeat DELETE reports the ORIGINAL stop time.
    const again: any = await terminateSession(1, 'ses_static');
    expect(again.billing_stopped_at).toBe(res.billing_stopped_at);
    expect(h.release).toHaveBeenCalledTimes(1);

    // Background retry: fail once, then succeed.
    const { runUpstreamCleanupOnce } = await import('../../src/modules/session/upstream-cleanup.service');
    const later = new Date(Date.now() + 2 * 60_000);
    h.release.mockRejectedValueOnce(new Error('still down'));
    expect(await runUpstreamCleanupOnce(later)).toEqual({ done: 0, retried: 1, failed: 0 });
    expect(job.attempts).toBe(2);
    expect(await runUpstreamCleanupOnce(new Date(later.getTime() + 10 * 60_000))).toEqual({ done: 1, retried: 0, failed: 0 });
    expect(job.status).toBe('done');
  });

  it('gives up after the max attempts and pages the owner', async () => {
    const { runUpstreamCleanupOnce, CLEANUP_MAX_ATTEMPTS } = await import('../../src/modules/session/upstream-cleanup.service');
    h.fake.db.upstreamCleanupJob.push({
      id: 99, agentId: 1, sessionId: 'ses_x', backendOrderNo: 'ORDX', status: 'pending',
      attempts: CLEANUP_MAX_ATTEMPTS - 1, billingStoppedAt: new Date(), nextAttemptAt: new Date(0),
    });
    h.release.mockRejectedValue(new Error('down'));
    expect(await runUpstreamCleanupOnce()).toEqual({ done: 0, retried: 0, failed: 1 });
    expect(h.alerts.some((a) => a[0] === 'UPSTREAM_CLEANUP_GAVE_UP' && a[1] === 'critical')).toBe(true);
  });

  it('releases normally when the upstream is up', async () => {
    h.fake.db.agentSession.push(session());
    h.release.mockResolvedValue({});
    const { terminateSession } = await import('../../src/modules/session/session.service');
    const res: any = await terminateSession(1, 'ses_static');
    expect(res.upstream_cleanup).toEqual({ status: 'released' });
    expect(h.fake.db.upstreamCleanupJob).toHaveLength(0);
  });
});
