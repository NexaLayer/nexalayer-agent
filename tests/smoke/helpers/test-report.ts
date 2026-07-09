import { getContext } from './test-context';
import {
  AGENT_BASE_URL,
  BACKEND_BASE_URL,
  BACKEND_INTERNAL_URL,
  AGENT_DATABASE_URL,
} from '../setup';
import {
  CONTRACT_VERSION,
} from './backend-contracts';

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min > 0) {
    return `${min}m ${sec % 60}s`;
  }
  return `${sec}s`;
}

export function printTestReport(): void {
  const ctx = getContext();
  const dur =
    Date.now() - ctx.startedAt.getTime();

  console.log('\n' + '='.repeat(72));
  console.log('  SMOKE TEST REPORT');
  console.log('='.repeat(72));

  console.log('\n--- Run Environment ---');
  console.log(
    `  AGENT_BASE_URL:      ${AGENT_BASE_URL}`
  );
  console.log(
    `  BACKEND_BASE_URL:    ${BACKEND_BASE_URL}`
  );
  console.log(
    `  BACKEND_INTERNAL:    ` +
      `${BACKEND_INTERNAL_URL}`
  );
  console.log(
    `  DB configured:       ` +
      `${AGENT_DATABASE_URL ? 'yes' : 'no'}`
  );

  console.log('\n--- Build Info ---');
  console.log(
    `  Commit:           ${ctx.commitHash}`
  );
  console.log(
    `  Contract version: ${CONTRACT_VERSION}`
  );
  console.log(
    `  Duration:         ${formatDuration(dur)}`
  );

  console.log('\n--- Agent Info ---');
  console.log(
    `  Agent Name:    ${ctx.agentName}`
  );
  console.log(
    `  Agent ID:      ${ctx.agentId}`
  );
  console.log(
    `  Backend User:  ${ctx.backendUsername}`
  );

  console.log('\n--- Resource Consumption ---');
  const created = ctx.createdSessionIds.length;
  console.log(
    `  Sessions Created:    ${created}`
  );
  console.log(
    `  Sessions Terminated: ` +
      `${ctx.terminatedCount}`
  );
  console.log(
    `  Sessions Residual:   ` +
      `${ctx.residualCount}`
  );

  console.log('\n--- Balance Impact ---');
  const delta =
    ctx.balanceBefore - ctx.balanceAfter;
  console.log(
    `  Before: ${ctx.balanceBefore}`
  );
  console.log(
    `  After:  ${ctx.balanceAfter}`
  );
  console.log(
    `  Delta:  ${delta.toFixed(2)}`
  );

  const perfEntries = Object.entries(
    ctx.perfMetrics
  );
  if (perfEntries.length > 0) {
    console.log(
      '\n--- Performance Metrics ---'
    );
    const hdr =
      'Endpoint'.padEnd(32) +
      'p50(ms)'.padStart(10) +
      'p95(ms)'.padStart(10) +
      'max(ms)'.padStart(10);
    console.log(`  ${hdr}`);
    console.log('  ' + '-'.repeat(62));
    for (const [ep, m] of perfEntries) {
      const name =
        ep.length > 30
          ? ep.slice(0, 27) + '...'
          : ep;
      const row =
        name.padEnd(32) +
        String(m.p50).padStart(10) +
        String(m.p95).padStart(10) +
        String(m.max).padStart(10);
      console.log(`  ${row}`);
    }
  }

  console.log(
    '\n--- External Dependencies ---'
  );
  console.log(
    `  Agent API:    ` +
      `${ctx.agentId > 0 ? 'OK' : 'FAIL'}`
  );
  console.log(
    `  Backend API:  ` +
      `${ctx.backendUserId > 0 ? 'OK' : 'UNKNOWN'}`
  );
  console.log(
    `  Agent DB:     ` +
      `${AGENT_DATABASE_URL ? 'CONFIGURED' : 'N/A'}`
  );

  console.log('\n' + '='.repeat(72) + '\n');
}
