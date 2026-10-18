// Public known-issues feed. Edit via reviewed PRs; account-specific data
// never belongs here. `status` uses: investigating | identified |
// monitoring | workaround_available | resolved.

export type WorkaroundStep =
  | { action: 'wait'; seconds: number }
  | { action: 'call'; method: string; path: string; idempotent?: boolean; expect?: Record<string, unknown> }
  | { action: 'set_param'; name: string; value: unknown }
  | { action: 'ask_owner'; reason: string }
  | { action: 'report_issue'; with?: Record<string, unknown> }
  | { action: 'upgrade'; package: string; min_version: string };

export type KnownIssue = {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'workaround_available' | 'resolved';
  severity: 'S1' | 'S2' | 'S3' | 'S4';
  components: string[];
  error_codes: string[];
  match?: { endpoint?: string; http_status?: number[] };
  first_seen: string;
  updated_at: string;
  workaround: { steps: WorkaroundStep[]; billing_note?: string } | null;
  fixed_in: Record<string, string> | null;
};

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: 'KI-2026-001',
    title: 'Static session terminate: upstream release can fail transiently',
    status: 'workaround_available',
    severity: 'S3',
    components: ['sessions', 'upstream_network'],
    error_codes: ['UPSTREAM_UNAVAILABLE', 'BACKEND_ERROR', 'BACKEND_TIMEOUT'],
    match: { endpoint: 'DELETE /v1/sessions/{session_id}' },
    first_seen: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    workaround: {
      steps: [
        { action: 'call', method: 'GET', path: '/v1/sessions/{session_id}', expect: { 'data.status': 'terminated' } },
        { action: 'wait', seconds: 60 },
        { action: 'report_issue', with: { category: 'bug', known_issue_id: 'KI-2026-001' } },
      ],
      billing_note: 'Billing stops at the first terminate attempt. NexaLayer retries the upstream release in the background; the session is already marked terminated.',
    },
    fixed_in: null,
  },
];

const OPEN = new Set(['investigating', 'identified', 'monitoring', 'workaround_available']);

export function listKnownIssues(filter: {
  status?: string;
  error_code?: string;
  component?: string;
  since?: string;
} = {}): KnownIssue[] {
  const since = filter.since ? Date.parse(filter.since) : NaN;
  return KNOWN_ISSUES.filter((issue) => {
    if (filter.status === 'open' && !OPEN.has(issue.status)) return false;
    if (filter.status && filter.status !== 'open' && issue.status !== filter.status) return false;
    if (filter.error_code && !issue.error_codes.includes(filter.error_code)) return false;
    if (filter.component && !issue.components.includes(filter.component)) return false;
    if (!Number.isNaN(since) && Date.parse(issue.updated_at) < since) return false;
    return true;
  });
}

/**
 * First open known issue that lists any of the given error codes. Issues
 * scoped to an endpoint (match.endpoint, e.g. "DELETE /v1/sessions/{session_id}")
 * only match when that endpoint is given — or when `endpoint` is omitted
 * entirely and `requireEndpoint` is false (ticket triage, where the
 * reporter may not name the endpoint).
 */
export function matchKnownIssue(
  errorCodes: string[],
  options: { endpoint?: string; requireEndpoint?: boolean } = {}
): KnownIssue | null {
  if (errorCodes.length === 0) return null;
  return KNOWN_ISSUES.find((issue) => {
    if (!OPEN.has(issue.status)) return false;
    if (!issue.error_codes.some((code) => errorCodes.includes(code))) return false;
    const scoped = issue.match?.endpoint;
    if (!scoped) return true;
    if (options.endpoint) return normalizeEndpoint(options.endpoint) === normalizeEndpoint(scoped);
    return !options.requireEndpoint;
  }) ?? null;
}

/** "DELETE /v1/sessions/:session_id" and "DELETE /v1/sessions/{id}" compare equal. */
export function normalizeEndpoint(endpoint: string): string {
  return endpoint
    .trim()
    .replace(/\?.*$/, '')
    .replace(/\{[^}]+\}|:[A-Za-z_][A-Za-z0-9_]*/g, '{}')
    .toUpperCase();
}
