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
