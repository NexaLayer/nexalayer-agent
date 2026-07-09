import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('safe smoke: static MVP contract', () => {
  it('publishes the Phase 1 API contract and examples', () => {
    expect(existsSync('openapi/openapi.yaml')).toBe(true);
    expect(
      existsSync('examples/python-quickstart/main.py')
    ).toBe(true);
    expect(
      existsSync('examples/playwright-session-demo/index.mjs')
    ).toBe(true);
    expect(existsSync('scripts/phase0-smoke.mjs')).toBe(true);
  });

  it('documents session telemetry, idempotency, and proxy.full_url', () => {
    const openapi = read('openapi/openapi.yaml');
    expect(openapi).toContain('/sessions/{session_id}/report-event');
    expect(openapi).toContain('/sessions/{session_id}/health');
    expect(openapi).toContain('Idempotency-Key');
    expect(openapi).toContain('full_url');
  });

  it('treats timeout as a health-affecting failure signal', () => {
    const telemetry = read('src/modules/telemetry/telemetry.service.ts');
    expect(telemetry).toMatch(/'timeout'/);
    expect(telemetry).toContain("eventType === 'timeout'");
    expect(telemetry).toContain('? -5');
  });

  it('does not keep hard-coded migrated credentials in source', () => {
    const trackedText = [
      read('tests/smoke/setup.ts'),
      read('tests/regression/conversation-flow.test.ts'),
      read('tests/regression/dynamic-conversation-flow.test.ts'),
      read('tests/regression/static-pricing-role.test.ts'),
      read('tests/regression/static-order-display.test.ts'),
      read('tests/regression/transaction-display.test.ts'),
    ].join('\n');

    expect(trackedText).not.toMatch(
      /password:\s*['"][^'"]{6,}['"]/
    );
    expect(trackedText).not.toMatch(
      /postgresql:\/\/[^<\s]+:[^<\s]+@/
    );
  });
});
