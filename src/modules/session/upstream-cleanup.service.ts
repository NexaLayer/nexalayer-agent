import { prisma } from '../../app';
import { env } from '../../config/env';
import * as backend from '../../gateway/backend-client';
import { OPS_ALERT_EVENTS, sendOpsAlert } from '../ops/ops-alert.service';
import { redactString } from '../support/redact';

// Owner policy: if the upstream is down during terminate, billing stops at
// the FIRST terminate attempt. We record that moment and keep retrying the
// upstream release in the background until it succeeds or we give up and
// page the owner.

export const CLEANUP_MAX_ATTEMPTS = 12;
const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 6 * 3_600_000;

export function cleanupBackoffMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

function safeError(error: unknown): string {
  return redactString(error instanceof Error ? error.message : String(error)).value.slice(0, 300);
}

/** Record a failed first terminate attempt; billing stops at `billingStoppedAt`. */
export async function scheduleUpstreamCleanup(params: {
  agentId: number;
  sessionId: string;
  backendOrderNo: string;
  error: unknown;
  billingStoppedAt: Date;
}): Promise<{ billing_stopped_at: string; next_attempt_at: string }> {
  const lastError = safeError(params.error);
  const nextAttemptAt = new Date(params.billingStoppedAt.getTime() + cleanupBackoffMs(1));
  await prisma.upstreamCleanupJob.upsert({
    where: { sessionId: params.sessionId },
    // Keep the original billing stop time if the job already exists.
    create: {
      agentId: params.agentId,
      sessionId: params.sessionId,
      backendOrderNo: params.backendOrderNo,
      status: 'pending',
      attempts: 1,
      lastError,
      billingStoppedAt: params.billingStoppedAt,
      nextAttemptAt,
    },
    update: { lastError },
  });
  void sendOpsAlert(
    OPS_ALERT_EVENTS.UPSTREAM_TERMINATE_FAILED,
    'warning',
    {
      session_id: params.sessionId,
      agent_id: params.agentId,
      billing_stopped_at: params.billingStoppedAt.toISOString(),
      error: lastError,
      action: 'Session marked terminated; billing stopped; upstream release retrying in background.',
    },
    { dedupeKey: params.sessionId }
  );
  return { billing_stopped_at: params.billingStoppedAt.toISOString(), next_attempt_at: nextAttemptAt.toISOString() };
}

/** Process due cleanup jobs once. Returns counts for observability/tests. */
export async function runUpstreamCleanupOnce(
  now: Date = new Date(),
  release: (orderNo: string) => Promise<unknown> = backend.releaseZtProxyStaticOrder
): Promise<{ done: number; retried: number; failed: number }> {
  const jobs = await prisma.upstreamCleanupJob.findMany({
    where: { status: 'pending', nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: 'asc' },
    take: 20,
  });
  const counts = { done: 0, retried: 0, failed: 0 };
  for (const job of jobs) {
    try {
      await release(job.backendOrderNo);
      await prisma.upstreamCleanupJob.update({
        where: { id: job.id },
        data: { status: 'done', completedAt: now, attempts: job.attempts + 1 },
      });
      counts.done += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const giveUp = attempts >= CLEANUP_MAX_ATTEMPTS;
      await prisma.upstreamCleanupJob.update({
        where: { id: job.id },
        data: {
          attempts,
          lastError: safeError(error),
          status: giveUp ? 'failed' : 'pending',
          nextAttemptAt: new Date(now.getTime() + cleanupBackoffMs(attempts)),
        },
      });
      if (giveUp) {
        counts.failed += 1;
        void sendOpsAlert(
          OPS_ALERT_EVENTS.UPSTREAM_CLEANUP_GAVE_UP,
          'critical',
          {
            session_id: job.sessionId,
            agent_id: job.agentId,
            attempts,
            billing_stopped_at: job.billingStoppedAt.toISOString(),
            error: safeError(error),
            action: 'Release the upstream order manually. Do not bill past billing_stopped_at.',
          },
          { dedupeKey: job.sessionId }
        );
      } else {
        counts.retried += 1;
      }
    }
  }
  return counts;
}

export function startUpstreamCleanupWorker(logger: { error: (obj: object, msg?: string) => void }): () => void {
  const tick = () => {
    void runUpstreamCleanupOnce().catch((error) => {
      logger.error({ error: safeError(error) }, 'Upstream cleanup worker failed');
    });
  };
  const timer = setInterval(tick, env.UPSTREAM_CLEANUP_INTERVAL_SECONDS * 1_000);
  timer.unref();
  return () => clearInterval(timer);
}
