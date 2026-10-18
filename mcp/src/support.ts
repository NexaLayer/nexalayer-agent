// Support helpers for the NexaLayer MCP server: a ring buffer of recent
// request ids / error codes (attached to tickets automatically) and
// structured tool-error results (MCP isError + structuredContent).

export type SeenRequest = { request_id: string; error_code: string | null; status: number; at: string };

export class RequestRing {
  private items: SeenRequest[] = [];
  constructor(private readonly size = 20) {}

  record(item: SeenRequest): void {
    if (!/^req_[A-Za-z0-9]+$/.test(item.request_id)) return;
    this.items.push(item);
    if (this.items.length > this.size) this.items.splice(0, this.items.length - this.size);
  }

  /** Most recent first. */
  recent(): SeenRequest[] {
    return [...this.items].reverse();
  }

  failures(): SeenRequest[] {
    return this.recent().filter((i) => i.status >= 400 || i.error_code);
  }
}

export type ApiErrorBody = {
  code?: string;
  message?: string;
  status?: number;
  retryable?: boolean;
  retry_after?: number | null;
  suggested_action?: string;
  doc_url?: string;
  known_issue_id?: string | null;
  side_effects?: Record<string, unknown>;
  request_id?: string;
  [key: string]: unknown;
};

export class NexaLayerApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly error: ApiErrorBody,
    readonly requestId: string | null,
  ) {
    super(`${error.code ?? 'HTTP_ERROR'} (${httpStatus}): ${error.message ?? 'request failed'}`);
    this.name = 'NexaLayerApiError';
  }
}

/** Parse an API response body into the error object, tolerating non-JSON bodies. */
export function parseApiError(httpStatus: number, text: string): { error: ApiErrorBody; requestId: string | null } {
  try {
    const body = JSON.parse(text) as { error?: ApiErrorBody; meta?: { request_id?: string } };
    const error = body.error && typeof body.error === 'object' ? body.error : { message: text.slice(0, 300) };
    return { error: { status: httpStatus, ...error }, requestId: body.meta?.request_id ?? error.request_id ?? null };
  } catch {
    return { error: { code: 'HTTP_ERROR', status: httpStatus, message: text.slice(0, 300) }, requestId: null };
  }
}

/** One-line summary an LLM can act on, plus the full envelope in structuredContent. */
export function toolErrorResult(err: unknown) {
  if (err instanceof NexaLayerApiError) {
    const e = err.error;
    const parts = [
      `${e.code ?? 'HTTP_ERROR'} (${err.httpStatus}): ${e.message ?? 'request failed'}.`,
      e.suggested_action ? `Action: ${e.suggested_action}.` : '',
      e.retryable && e.retry_after ? `Retry after ${e.retry_after}s.` : '',
      e.known_issue_id ? `Known issue: ${e.known_issue_id} (see nexalayer_known_issues).` : '',
      e.doc_url ? `Docs: ${e.doc_url}` : '',
      err.requestId ? `request_id: ${err.requestId}` : '',
    ].filter(Boolean);
    return {
      content: [{ type: 'text' as const, text: parts.join(' ') }],
      structuredContent: { error: e, request_id: err.requestId },
      isError: true,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { error: { code: 'CLIENT_ERROR', message } },
    isError: true,
  };
}

export type ReportIssueArgs = {
  category: string;
  summary: string;
  severity_claimed?: string;
  session_id?: string;
  error_codes?: string[];
  request_ids?: string[];
  known_issue_id?: string;
  expected?: string;
  actual?: string;
  tool?: string;
  desired_outcome?: string;
  idempotency_key?: string;
};

/** Build the POST /support/tickets body, auto-attaching recent failures. */
export function buildTicketBody(
  args: ReportIssueArgs,
  ring: RequestRing,
  client: { version: string; mcpClient?: string },
) {
  const failures = ring.failures();
  const requestIds = [...new Set([...(args.request_ids ?? []), ...failures.map((f) => f.request_id)])].slice(0, 20);
  const errorCodes = [...new Set([
    ...(args.error_codes ?? []),
    ...failures.map((f) => f.error_code).filter((c): c is string => Boolean(c)),
  ])].slice(0, 10);
  const reproduction = args.tool || args.expected || args.actual
    ? {
        method: 'MCP' as const,
        ...(args.tool ? { endpoint_or_tool: args.tool } : {}),
        ...(args.expected ? { expected: args.expected } : {}),
        ...(args.actual ? { actual: args.actual } : {}),
      }
    : undefined;
  return {
    category: args.category,
    summary: args.summary,
    ...(args.severity_claimed ? { severity_claimed: args.severity_claimed } : {}),
    ...(args.session_id ? { session_id: args.session_id } : {}),
    ...(requestIds.length ? { request_ids: requestIds } : {}),
    ...(errorCodes.length ? { error_codes: errorCodes } : {}),
    ...(args.known_issue_id ? { known_issue_id: args.known_issue_id } : {}),
    ...(reproduction ? { reproduction } : {}),
    ...(args.desired_outcome ? { desired_outcome: args.desired_outcome } : {}),
    ...(args.idempotency_key ? { idempotency_key: args.idempotency_key } : {}),
    client: {
      via: 'mcp' as const,
      sdk_or_mcp_version: `@nexalayer/mcp@${client.version}`,
      ...(client.mcpClient ? { mcp_client: client.mcpClient.slice(0, 100) } : {}),
    },
  };
}
