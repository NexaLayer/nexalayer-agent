import { supportContact } from './support-contact';

export type Severity = 'S1' | 'S2' | 'S3' | 'S4';

export const RESPONSE_TARGETS: Record<Severity, { definition: string; target: string; hours: number | null; business_days: number | null }> = {
  S1: { definition: 'Outage, or money charged incorrectly (wrong billing), or a security problem.', target: 'PT4H', hours: 4, business_days: null },
  S2: { definition: 'Something is broken and there is no workaround.', target: 'PT24H', hours: 24, business_days: null },
  S3: { definition: 'A bug that has a workaround.', target: 'P3BD', hours: null, business_days: 3 },
  S4: { definition: 'A question or a feature request.', target: 'best_effort', hours: null, business_days: null },
};

export function buildSla() {
  return {
    sla_version: '2026-10-18',
    kind: 'early_access_response_targets',
    disclaimer: 'Early-access response TARGETS, not guarantees or contractual commitments. NexaLayer is run by a small team; targets may change. No service credits are attached to these targets.',
    applies_to: 'Time from ticket creation (POST /v1/support/tickets) to the first triaged response or status update.',
    response_targets: (Object.keys(RESPONSE_TARGETS) as Severity[]).map((severity) => ({
      severity,
      ...RESPONSE_TARGETS[severity],
    })),
    severity_assignment: 'The server assigns severity; severity_claimed is a hint. The owner may override.',
    billing_policy: {
      terminate_during_upstream_outage: 'Billing stops at the first terminate attempt. NexaLayer records it and retries the upstream cleanup in the background.',
    },
    contact: supportContact(),
  };
}

/** Compute the first-response-by timestamp for a severity, or null for best effort. */
export function firstResponseBy(severity: Severity, from: Date = new Date()): Date | null {
  const t = RESPONSE_TARGETS[severity];
  if (t.hours !== null) return new Date(from.getTime() + t.hours * 3_600_000);
  if (t.business_days !== null) {
    const d = new Date(from.getTime());
    let added = 0;
    while (added < t.business_days) {
      d.setUTCDate(d.getUTCDate() + 1);
      const day = d.getUTCDay();
      if (day !== 0 && day !== 6) added += 1;
    }
    return d;
  }
  return null;
}
