import { prisma } from '../../app';
import { env } from '../../config/env';

type MonitorLogger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

let lastAlertWindow = '';

type TrialAlertPayload = {
  event: string;
  severity: string;
  claim_count: number;
  threshold: number;
  window_minutes: number;
  observed_at: string;
  runbook: string;
};

function windowKey(now: Date): string {
  const windowMs = env.TRIAL_ALERT_WINDOW_MINUTES * 60_000;
  return String(Math.floor(now.getTime() / windowMs));
}

export async function checkTrialClaimSurge(logger: MonitorLogger): Promise<void> {
  const now = new Date();
  const since = new Date(
    now.getTime() - env.TRIAL_ALERT_WINDOW_MINUTES * 60_000
  );
  const claimCount = await prisma.agentTrialClaim.count({
    where: { claimedAt: { gte: since } },
  });

  if (claimCount < env.TRIAL_ALERT_CLAIM_THRESHOLD) return;

  const currentWindow = windowKey(now);
  if (currentWindow === lastAlertWindow) return;
  lastAlertWindow = currentWindow;

  const payload = {
    event: 'TRIAL_CLAIM_SURGE',
    severity: 'warning',
    claim_count: claimCount,
    threshold: env.TRIAL_ALERT_CLAIM_THRESHOLD,
    window_minutes: env.TRIAL_ALERT_WINDOW_MINUTES,
    observed_at: now.toISOString(),
    runbook: 'docs/LAUNCH_48H_ONCALL.md',
  };
  logger.warn(payload, 'Trial claim volume exceeded the alert threshold');

  const hasTelegram = Boolean(
    env.TRIAL_ALERT_TELEGRAM_BOT_TOKEN &&
    env.TRIAL_ALERT_TELEGRAM_CHAT_ID
  );
  if (!env.TRIAL_ALERT_WEBHOOK_URL && !hasTelegram) {
    logger.error(
      payload,
      'No trial alert notification channel is configured'
    );
    return;
  }

  if (hasTelegram) {
    try {
      await sendTelegramAlert(payload);
    } catch (error) {
      logger.error(
        { ...payload, error: error instanceof Error ? error.message : String(error) },
        'Failed to send Telegram trial claim alert'
      );
    }
  }

  if (env.TRIAL_ALERT_WEBHOOK_URL) {
    try {
      const response = await fetch(env.TRIAL_ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      logger.error(
        { ...payload, error: error instanceof Error ? error.message : String(error) },
        'Failed to notify operator webhook about trial claim surge'
      );
    }
  }
}

async function sendTelegramAlert(payload: TrialAlertPayload): Promise<void> {
  const token = env.TRIAL_ALERT_TELEGRAM_BOT_TOKEN;
  const chatId = env.TRIAL_ALERT_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    'NexaLayer alert: trial claim surge',
    `Severity: ${payload.severity}`,
    `Claims: ${payload.claim_count} (threshold ${payload.threshold})`,
    `Window: ${payload.window_minutes} minutes`,
    `Observed: ${payload.observed_at}`,
    `Runbook: ${payload.runbook}`,
  ].join('\n');

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Telegram API HTTP ${response.status}`);
  }
}

export function startTrialClaimMonitor(logger: MonitorLogger): () => void {
  const check = () => {
    void checkTrialClaimSurge(logger).catch((error) => {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Trial claim monitor failed'
      );
    });
  };
  check();
  const timer = setInterval(
    check,
    env.TRIAL_ALERT_CHECK_INTERVAL_SECONDS * 1_000
  );
  timer.unref();
  return () => clearInterval(timer);
}
