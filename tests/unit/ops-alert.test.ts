import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, unknown> = {
  OPS_ALERT_DEDUPE_MINUTES: 30,
};
vi.mock('../../src/config/env', () => ({ env }));

const fetchMock = vi.fn();
const logger = { warn: vi.fn(), error: vi.fn() };

describe('sendOpsAlert', () => {
  beforeEach(async () => {
    for (const k of Object.keys(env)) if (k !== 'OPS_ALERT_DEDUPE_MINUTES') delete env[k];
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('../../src/modules/ops/ops-alert.service');
    mod.resetOpsAlertDedupeForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('dedupes to one alert per event (and key) per window', async () => {
    env.OPS_ALERT_TELEGRAM_BOT_TOKEN = 'test-ops-telegram-token-not-real';
    env.OPS_ALERT_TELEGRAM_CHAT_ID = '42';
    const { sendOpsAlert } = await import('../../src/modules/ops/ops-alert.service');
    const t0 = new Date('2026-10-18T00:00:00Z');
    const a = await sendOpsAlert('COMPONENT_STATUS_CHANGED', 'warning', { component: 'api' }, { dedupeKey: 'api:degraded', now: t0, logger });
    const b = await sendOpsAlert('COMPONENT_STATUS_CHANGED', 'warning', { component: 'api' }, { dedupeKey: 'api:degraded', now: new Date(t0.getTime() + 60_000), logger });
    const c = await sendOpsAlert('COMPONENT_STATUS_CHANGED', 'warning', { component: 'sessions' }, { dedupeKey: 'sessions:degraded', now: t0, logger });
    const d = await sendOpsAlert('COMPONENT_STATUS_CHANGED', 'warning', { component: 'api' }, { dedupeKey: 'api:degraded', now: new Date(t0.getTime() + 31 * 60_000), logger });
    expect([a.deduped, b.deduped, c.deduped, d.deduped]).toEqual([false, true, false, false]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(a.channels).toEqual(['telegram']);
  });

  it('falls back to TRIAL_ALERT_* and redacts secrets from the payload', async () => {
    env.TRIAL_ALERT_TELEGRAM_BOT_TOKEN = 'test-trial-telegram-token-not-real';
    env.TRIAL_ALERT_TELEGRAM_CHAT_ID = '-100';
    env.TRIAL_ALERT_WEBHOOK_URL = 'https://hooks.example.test/x';
    const { sendOpsAlert, resolveAlertChannels } = await import('../../src/modules/ops/ops-alert.service');
    expect(resolveAlertChannels().telegram?.chatId).toBe('-100');
    const res = await sendOpsAlert('UPSTREAM_TERMINATE_FAILED', 'warning', {
      session_id: 'ses_1',
      full_url: 'socks5://u:p@h:1',
      api_key: 'ak_0123456789abcdef0123456789abcdef',
      error: 'failed for socks5://bob:pw@1.1.1.1:1080',
      severity: 'S1',
    }, { logger });
    expect(res.channels).toEqual(['telegram', 'webhook']);
    const telegramBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const webhookBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    for (const body of [JSON.stringify(telegramBody), JSON.stringify(webhookBody)]) {
      expect(body).not.toContain('u:p@');
      expect(body).not.toContain('bob:pw');
      expect(body).not.toContain('ak_0123456789');
    }
    expect(webhookBody.severity).toBe('warning');
    expect(webhookBody.event).toBe('UPSTREAM_TERMINATE_FAILED');
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.telegram.org');
  });

  it('prefers OPS_ALERT_* over TRIAL_ALERT_*', async () => {
    env.TRIAL_ALERT_TELEGRAM_BOT_TOKEN = 'test-trial-telegram-token-not-real';
    env.TRIAL_ALERT_TELEGRAM_CHAT_ID = '-100';
    env.OPS_ALERT_TELEGRAM_BOT_TOKEN = 'test-ops-telegram-token-not-real';
    env.OPS_ALERT_TELEGRAM_CHAT_ID = '7';
    const { resolveAlertChannels } = await import('../../src/modules/ops/ops-alert.service');
    expect(resolveAlertChannels().telegram?.chatId).toBe('7');
  });

  it('logs and does not throw when no channel is configured or delivery fails', async () => {
    const { sendOpsAlert } = await import('../../src/modules/ops/ops-alert.service');
    const none = await sendOpsAlert('DEBIT_PROVISION_MISMATCH', 'critical', { a: 1 }, { logger });
    expect(none.channels).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
    env.OPS_ALERT_WEBHOOK_URL = 'https://hooks.example.test/y';
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const failed = await sendOpsAlert('DEBIT_PROVISION_MISMATCH', 'critical', { a: 1 }, { logger, dedupeKey: 'other' });
    expect(failed.failures[0]).toMatch(/webhook: network/);
  });
});
