import { writeFileSync } from 'fs';
import { join } from 'path';
import { AgentClient } from './agent-client';

interface CleanupRecord {
  sessionId: string;
  status: 'cleaned' | 'failed';
  error?: string;
  attempts: number;
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function cleanupSessions(
  client: AgentClient,
  sessionIds: string[]
): Promise<{ cleaned: number; failed: number }> {
  const report: CleanupRecord[] = [];

  for (const sid of sessionIds) {
    let cleaned = false;
    let lastError = '';

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      try {
        const check =
          await client.getSession(sid);
        const st = check.body?.data?.status;
        if (
          st === 'terminated' ||
          st === 'error'
        ) {
          report.push({
            sessionId: sid,
            status: 'cleaned',
            attempts: attempt,
          });
          cleaned = true;
          break;
        }

        if (st === 'creating') {
          await sleep(3000);
          continue;
        }

        const { status } =
          await client.terminateSession(sid);
        if (status >= 200 && status < 500) {
          report.push({
            sessionId: sid,
            status: 'cleaned',
            attempts: attempt,
          });
          cleaned = true;
          break;
        }
        lastError = `HTTP ${status}`;
      } catch (err) {
        lastError = (err as Error).message;
      }

      await sleep(
        BASE_DELAY * Math.pow(2, attempt - 1)
      );
    }

    if (!cleaned) {
      report.push({
        sessionId: sid,
        status: 'failed',
        error: lastError,
        attempts: MAX_RETRIES,
      });
    }
  }

  const failures = report.filter(
    (r) => r.status === 'failed'
  );
  const cleanedCount = report.filter(
    (r) => r.status === 'cleaned'
  ).length;

  if (failures.length > 0) {
    const reportPath = join(
      __dirname,
      '..',
      '..',
      '..',
      'cleanup-report.json'
    );
    try {
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            failures,
          },
          null,
          2
        )
      );
      console.warn(
        `[CLEANUP] ${failures.length} ` +
          `session(s) could not be terminated.` +
          ` See ${reportPath}`
      );
    } catch {
      console.warn(
        '[CLEANUP] Failed to write ' +
          'cleanup report'
      );
    }
  }

  console.log(
    `[CLEANUP] cleaned=${cleanedCount}, ` +
      `failed=${failures.length}`
  );

  return {
    cleaned: cleanedCount,
    failed: failures.length,
  };
}

export async function waitForSessionReady(
  client: AgentClient,
  sessionId: string,
  maxWaitMs = 30_000,
  pollIntervalMs = 2_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { body } =
      await client.getSession(sessionId);
    const status = body.data?.status;
    if (
      status === 'active' ||
      status === 'error' ||
      status === 'terminated'
    ) {
      return status;
    }
    await sleep(pollIntervalMs);
  }
  return 'timeout';
}
