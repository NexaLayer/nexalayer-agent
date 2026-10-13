import { prisma } from '../../app';
import { env } from '../../config/env';

type MonitorLogger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

let lastAlertWindow = '';

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

  if (!env.TRIAL_ALERT_WEBHOOK_URL) {
    logger.error(
      payload,
      'TRIAL_ALERT_WEBHOOK_URL is not configured; no operator notification was sent'
    );
    return;
  }

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
      'Failed to notify operator about trial claim surge'
    );
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
