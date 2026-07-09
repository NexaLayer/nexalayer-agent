import { AGENT_BASE_URL } from '../setup';

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  meta?: { request_id: string; latency_ms: number };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

type AuthMode = 'api_key' | 'bearer' | 'none';

export class AgentClient {
  private apiKey = '';
  private apiSecret = '';
  private bearerToken = '';
  private authMode: AuthMode = 'none';

  setApiKey(key: string, secret: string): void {
    this.apiKey = key;
    this.apiSecret = secret;
  }

  useApiKeyAuth(): void {
    this.authMode = 'api_key';
  }

  useBearerAuth(): void {
    this.authMode = 'bearer';
  }

  useNoAuth(): void {
    this.authMode = 'none';
  }

  setBearerToken(token: string): void {
    this.bearerToken = token;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getApiSecret(): string {
    return this.apiSecret;
  }

  private authHeaders(): Record<string, string> {
    if (this.authMode === 'api_key' && this.apiKey) {
      return { 'X-API-Key': this.apiKey };
    }
    if (
      this.authMode === 'bearer' &&
      this.bearerToken
    ) {
      return {
        Authorization: `Bearer ${this.bearerToken}`,
      };
    }
    return {};
  }

  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<{
    status: number;
    body: ApiResponse<T>;
    headers: Headers;
    latencyMs: number;
  }> {
    const url = `${AGENT_BASE_URL}${path}`;
    const controller = new AbortController();
    const timeout = options.timeout ?? 30_000;
    const timer = setTimeout(
      () => controller.abort(),
      timeout
    );

    const start = Date.now();
    try {
      const hdrs: Record<string, string> = {
        ...this.authHeaders(),
        ...options.headers,
      };
      if (options.body) {
        hdrs['Content-Type'] =
          'application/json';
      }
      const res = await fetch(url, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: hdrs,
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
      });

      const latencyMs = Date.now() - start;
      const body = (await res.json()) as ApiResponse<T>;
      return {
        status: res.status,
        body,
        headers: res.headers,
        latencyMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async register(
    agentName: string,
    contactEmail: string,
    referralCode?: string
  ) {
    const body: Record<string, string> = {
      name: agentName,
      contact_email: contactEmail,
    };
    if (referralCode !== undefined) {
      body.referral_code = referralCode;
    }
    return this.request<{
      agent_id: number;
      name: string;
      api_key: string;
      api_secret: string;
      status: string;
      referral?: {
        agent_id: number;
        agent_name: string;
      };
      trial: {
        is_trial: boolean;
        trial_balance: number;
        trial_expires_at: string;
      };
    }>('/v1/account/register', {
      method: 'POST',
      body,
    });
  }

  async getToken() {
    return this.request<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>('/v1/auth/token', {
      method: 'POST',
      body: {
        api_key: this.apiKey,
        api_secret: this.apiSecret,
      },
    });
  }

  async refreshToken() {
    return this.request<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>('/v1/auth/refresh', {
      method: 'POST',
    });
  }

  async getAccountInfo() {
    return this.request<{
      agent_id: number;
      agent_name: string;
      status: string;
      balance: number;
      trial_balance: number;
    }>('/v1/account/info');
  }

  async listProducts(
    type: 'all' | 'static' | 'dynamic' = 'all'
  ) {
    return this.request<{
      items: Array<{
        product_no: string;
        name: string;
        type: string;
        price: number;
        unit: string;
        stock?: number;
        proxy_type?: number;
        country?: string;
        city?: string;
      }>;
      total: number;
    }>(`/v1/products?type=${type}`);
  }

  async listRegions() {
    return this.request<{
      items: Array<{
        code: string;
        name: string;
        children?: unknown[];
      }>;
    }>('/v1/products/regions');
  }

  async createSession(params: {
    session_type: 'static' | 'dynamic';
    product_no: string;
    quantity?: number;
    duration?: number;
    protocol?: 'socks5' | 'http' | 'https';
    country_code?: string;
    city_code?: string;
    rotation_mode?: 'fixed' | 'timed' | 'on_demand';
  }) {
    return this.request<{
      session_id: string;
      session_type: string;
      status: string;
      message?: string;
      created_at: string;
    }>('/v1/sessions', {
      method: 'POST',
      body: params,
    });
  }

  async getSession(sessionId: string) {
    return this.request<{
      session_id: string;
      session_type: string;
      status: string;
      proxy?: {
        host: string;
        port: number;
        username: string;
        password: string;
        protocol: string;
      };
      health: {
        risk_level: string;
        health_score: number;
        success_rate: number;
        consecutive_failures: number;
        last_error_type: string | null;
        total_events: number;
      };
      backend_order_no: string | null;
      expires_at: string | null;
      created_at: string;
    }>(`/v1/sessions/${sessionId}`);
  }

  async listSessions(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    session_type?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.page)
      qs.set('page', String(params.page));
    if (params?.page_size)
      qs.set('page_size', String(params.page_size));
    if (params?.status)
      qs.set('status', params.status);
    if (params?.session_type)
      qs.set('session_type', params.session_type);
    return this.request<{
      items: Array<{
        session_id: string;
        status: string;
        session_type: string;
      }>;
      total: number;
    }>(`/v1/sessions?${qs}`);
  }

  async rotateSession(
    sessionId: string,
    reason?: string
  ) {
    return this.request(
      `/v1/sessions/${sessionId}/rotate`,
      {
        method: 'POST',
        body: { reason: reason ?? 'manual' },
      }
    );
  }

  async terminateSession(sessionId: string) {
    return this.request(
      `/v1/sessions/${sessionId}`,
      { method: 'DELETE' }
    );
  }

  async renewSession(
    sessionId: string,
    duration: number
  ) {
    return this.request(
      `/v1/sessions/${sessionId}/renew`,
      {
        method: 'POST',
        body: { duration },
      }
    );
  }

  async reportEvent(
    sessionId: string,
    event: {
      event_type: string;
      status_code?: number;
      latency_ms?: number;
      target_host?: string;
      error_message?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.request<{
      recorded: boolean;
      risk_level: string;
      block_probability: number;
    }>(`/v1/sessions/${sessionId}/report-event`, {
      method: 'POST',
      body: event,
    });
  }

  async batchReport(
    events: Array<{
      session_id: string;
      event_type: string;
      status_code?: number;
      latency_ms?: number;
    }>
  ) {
    return this.request<{
      processed: number;
      results: unknown[];
    }>('/v1/telemetry/batch', {
      method: 'POST',
      body: { events },
    });
  }

  async getSessionHealth(sessionId: string) {
    return this.request<{
      session_id: string;
      risk_level: string;
      health_score: number;
      success_rate: number;
      consecutive_failures: number;
      recommendation: string;
      recent_events: unknown[];
    }>(`/v1/sessions/${sessionId}/health`);
  }

  async getBalance() {
    return this.request<{
      balance: number;
    }>('/v1/billing/balance');
  }

  async createRechargeOrder(amount: number) {
    return this.request<{
      order_id: string;
      amount: number;
      status: string;
      pay_url?: string;
    }>('/v1/billing/recharge', {
      method: 'POST',
      body: { amount },
    });
  }

  async checkRechargeStatus(orderId: string) {
    return this.request<{
      order_id: string;
      status: string;
      amount: number;
    }>(`/v1/billing/recharge/${orderId}/status`);
  }

  async getTransactions(params?: {
    page?: number;
    page_size?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.page)
      qs.set('page', String(params.page));
    if (params?.page_size)
      qs.set('page_size', String(params.page_size));
    return this.request<{
      items: unknown[];
      total: number;
    }>(`/v1/billing/transactions?${qs}`);
  }

  async getStats() {
    return this.request('/v1/stats/overview');
  }

  async health() {
    return this.request<{
      status: string;
      version?: string;
    }>('/v1/health');
  }

  async createSessionWithIdempotency(
    params: {
      session_type: 'static' | 'dynamic';
      product_no: string;
      quantity?: number;
      protocol?: 'socks5' | 'http' | 'https';
    },
    idempotencyKey: string
  ) {
    return this.request<{
      session_id: string;
      status: string;
    }>('/v1/sessions', {
      method: 'POST',
      body: params,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
  }
}
