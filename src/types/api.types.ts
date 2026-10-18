export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  // Machine-readable support fields (additive; error_schema_version "1").
  status?: number;
  category?: string;
  retryable?: boolean;
  retry_after?: number | null;
  suggested_action?: string;
  side_effects?: Record<string, boolean | 'unknown'>;
  doc_url?: string;
  known_issue_id?: string | null;
  request_id?: string;
  support?: Record<string, string>;
  error_schema_version?: string;
}

export interface ApiMeta {
  request_id: string;
  timestamp: string;
  latency_ms?: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface AgentContext {
  agentId: number;
  apiKey: string;
  permissions: string[];
}
