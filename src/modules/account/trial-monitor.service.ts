import { prisma } from '../../app';
import { env } from '../../config/env';
import { OPS_ALERT_EVENTS, sendOpsAlert } from '../ops/ops-alert.service';

type MonitorLogger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
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

  // One alert per alert window (same behavior as before the shared
  // sendOpsAlert helper existed).
  await sendOpsAlert(
    OPS_ALERT_EVENTS.TRIAL_CLAIM_SURGE,
    'warning',
    {
      claim_count: claimCount,
      threshold: env.TRIAL_ALERT_CLAIM_THRESHOLD,
      window_minutes: env.TRIAL_ALERT_WINDOW_MINUTES,
      runbook: 'docs/LAUNCH_48H_ONCALL.md',
    },
    {
      dedupeKey: windowKey(now),
      windowMinutes: env.TRIAL_ALERT_WINDOW_MINUTES,
      logger,
      now,
    }
  );
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
