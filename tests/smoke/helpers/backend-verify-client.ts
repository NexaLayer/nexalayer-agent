import {
  BACKEND_BASE_URL,
  BACKEND_AGENT_USERNAME,
  BACKEND_AGENT_PASSWORD,
} from '../setup';

/**
 * Client for Backend API verification.
 * Uses openAgent credentials to verify cross-system
 * data consistency.
 */
export class BackendVerifyClient {
  private agentToken = '';
  private agentUserId = 0;
  private agentBalance = 0;

  async login(): Promise<void> {
    const res = await this.post<{
      code: number;
      data: {
        token: string;
        user: {
          id: number;
          username: string;
          balance: number;
        };
      };
    }>('/api/auth/login', {
      username: BACKEND_AGENT_USERNAME,
      password: BACKEND_AGENT_PASSWORD,
    });
    this.agentToken = res.data.token;
    this.agentUserId = res.data.user.id;
    this.agentBalance = res.data.user.balance;
  }

  getToken(): string {
    return this.agentToken;
  }

  getAgentUserId(): number {
    return this.agentUserId;
  }

  getAgentBalance(): number {
    return this.agentBalance;
  }

  async getUserByUsername(
    username: string
  ): Promise<{
    id: number;
    username: string;
    balance: number;
    status: string;
    agent_id?: number;
    agent_name?: string;
  } | null> {
    try {
      const res = await this.get<{
        code: number;
        data: {
          list: Array<{
            id: number;
            username: string;
            balance: number;
            status: string;
            agent_id?: number;
            agent_name?: string;
          }>;
          total: number;
        };
      }>(
        `/api/open/app/users/list` +
          `?username=${encodeURIComponent(username)}`
      );
      const users = res.data?.list ?? [];
      return users.find(
        (u) => u.username === username
      ) ?? null;
    } catch {
      return null;
    }
  }

  async getBalance(): Promise<number> {
    const res = await this.get<{
      code: number;
      data: { balance: number };
    }>('/api/open/app/user/balance/current');
    return res.data.balance;
  }

  async getUserBalance(
    userToken: string
  ): Promise<number> {
    const res = await fetch(
      `${BACKEND_BASE_URL}/api/open/app/user/balance/current`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
    const body = (await res.json()) as {
      code: number;
      data: { balance: number };
    };
    return body.data.balance;
  }

  async getUserTokenByCredentials(
    username: string,
    password: string
  ): Promise<string> {
    const res = await fetch(
      `${BACKEND_BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      }
    );
    const body = (await res.json()) as {
      code: number;
      data: { token: string };
    };
    return body.data.token;
  }

  async adjustUserBalance(
    userId: number,
    amount: number,
    remark?: string
  ): Promise<{
    id: number;
    username: string;
    balance: number;
  }> {
    const res = await this.post<{
      code: number;
      data: {
        id: number;
        username: string;
        balance: number;
      };
    }>(`/api/open/app/user/${userId}/balance`, {
      amount,
      remark: remark ?? 'smoke-test-topup',
    });
    return res.data;
  }

  async getDashboard(): Promise<
    Record<string, unknown>
  > {
    const res = await this.get<{
      code: number;
      data: Record<string, unknown>;
    }>('/api/open/app/dashboard/info/v2');
    return res.data;
  }

  async getStaticOrders(params?: {
    page?: number;
  }): Promise<{
    items: Array<{
      order_no: string;
      status: string;
      user_id: number;
    }>;
    total: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.page)
      qs.set('page', String(params.page));
    const res = await this.get<{
      code: number;
      data: {
        items: Array<{
          order_no: string;
          status: string;
          user_id: number;
        }>;
        total: number;
      };
    }>(
      `/api/open/app/static/order/list/v2?${qs}`
    );
    return res.data;
  }

  async getTransactionsByOrderNo(
    orderNo: string
  ): Promise<Array<{
    transaction_no: string;
    user_id: number;
    agent_id: number;
    order_no: string;
    amount: number;
    balance: number;
    type: string;
    status: string;
    remark: string;
  }>> {
    const res = await this.get<{
      code: number;
      data: {
        items: Array<{
          transaction_no: string;
          user_id: number;
          agent_id: number;
          order_no: string;
          amount: number;
          balance: number;
          type: string;
          status: string;
          remark: string;
        }>;
        total: number;
      };
    }>(
      `/api/open/app/user/transactions` +
        `?order_no=${encodeURIComponent(orderNo)}` +
        `&page_size=50`
    );
    return res.data?.items ?? [];
  }

  async getAgentTransactionsByOrderNo(
    orderNo: string,
    targetUserId?: number
  ): Promise<Array<{
    transaction_no: string;
    user_id: number;
    agent_id: number;
    order_no: string;
    amount: number;
    type: string;
    status: string;
    remark: string;
  }>> {
    let qs =
      `order_no=${encodeURIComponent(orderNo)}` +
      `&page_size=50`;
    if (targetUserId) {
      qs += `&target_user_id=${targetUserId}`;
    }
    const res = await this.get<{
      code: number;
      data: {
        items: Array<{
          transaction_no: string;
          user_id: number;
          agent_id: number;
          order_no: string;
          amount: number;
          type: string;
          status: string;
          remark: string;
        }>;
        total: number;
      };
    }>(
      `/api/open/app/user/transactions?${qs}`
    );
    return res.data?.items ?? [];
  }

  async getUserRecentTransactions(
    targetUserId: number,
    pageSize = 20
  ): Promise<Array<{
    transaction_no: string;
    order_no: string;
    amount: number;
    type: string;
    remark: string;
  }>> {
    const qs =
      `target_user_id=${targetUserId}` +
      `&page_size=${pageSize}`;
    const res = await this.get<{
      code: number;
      data: {
        items: Array<{
          transaction_no: string;
          order_no: string;
          amount: number;
          type: string;
          remark: string;
        }>;
      };
    }>(
      `/api/open/app/user/transactions?${qs}`
    );
    return res.data?.items ?? [];
  }

  async getDynamicOrders(params?: {
    userId?: number;
  }): Promise<Array<{
    order_no: string;
    user_id: number;
    agent_id: number;
    traffic: number;
    total_amount: number;
    status: string;
  }>> {
    const qs = new URLSearchParams();
    qs.set('page', '1');
    qs.set('pageSize', '50');
    if (params?.userId)
      qs.set('userId', String(params.userId));
    const res = await this.get<{
      code: number;
      data: {
        items: Array<{
          order_no: string;
          user_id: number;
          agent_id: number;
          traffic: number;
          total_amount: number;
          status: string;
        }>;
      };
    }>(`/api/dynamic?${qs}`);
    return res.data?.items ?? [];
  }

  async getStaticOrderDetail(
    orderNo: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const res = await this.get<{
        code: number;
        data: Record<string, unknown>;
      }>(
        `/api/open/app/static/order/${orderNo}/v2`
      );
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  async renewStaticOrder(
    instanceNo: string,
    duration: number
  ): Promise<Record<string, unknown>> {
    const res = await this.post<{
      code: number;
      msg: string;
      data: Record<string, unknown>;
    }>('/api/renew-order', {
      instanceNo,
      duration,
    });
    return res.data;
  }

  async setUserBalanceToZero(
    userId: number
  ): Promise<void> {
    const userInfo = await this.get<{
      code: number;
      data: { balance: number };
    }>(`/api/open/app/user/${userId}/balance`);

    const current = userInfo.data?.balance ?? 0;
    if (current > 0) {
      await this.post(
        `/api/open/app/user/${userId}/balance`,
        {
          amount: -current,
          remark:
            'smoke-test cleanup: zero balance',
        }
      );
    }
  }

  async zeroOutUserIpwebFlow(
    userId: number
  ): Promise<void> {
    try {
      const listRes = await this.get<{
        code: number;
        data: Array<{
          id: number;
          username: string;
          limit_flow: number;
        }>;
        main_ipweb_username?: string;
      }>(
        `/api/ipweb-sub-users/list` +
          `?user_id=${userId}`
      );

      const mainUser =
        listRes.main_ipweb_username;
      if (mainUser) {
        await this.post(
          `/api/agent/ipweb/adjust-flow`,
          {
            username: mainUser,
            targetGb: 0,
            productNo: 'dynamic_ipweb',
          }
        );
        console.log(
          `[cleanup] Zeroed IPWEB flow ` +
            `for ${mainUser}`
        );
      }

      const subs = listRes.data ?? [];
      for (const sub of subs) {
        if (sub.limit_flow > 0) {
          await this.post(
            `/api/agent/ipweb/adjust-flow`,
            {
              username: sub.username,
              targetGb: 0,
              productNo: 'dynamic_ipweb',
            }
          );
          console.log(
            `[cleanup] Zeroed flow for ` +
              `sub ${sub.username}`
          );
        }
      }
    } catch (err) {
      console.warn(
        '[cleanup] zeroOutUserIpwebFlow:',
        (err as Error).message
      );
    }
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${BACKEND_BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.agentToken}`,
      },
    });
    return (await res.json()) as T;
  }

  private async post<T>(
    path: string,
    body: unknown
  ): Promise<T> {
    const url = `${BACKEND_BASE_URL}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.agentToken}`,
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }
}
