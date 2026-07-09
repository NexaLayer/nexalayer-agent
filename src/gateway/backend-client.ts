import { env } from '../config/env';
import NodeCache from 'node-cache';
import { mapBackendError, mapBackendTimeout } from './error-mapper';
import {
  BackendResponse,
  BackendLoginResponse,
  BackendBalanceResponse,
  BackendAreaHierarchyResponse,
  BackendProductResponse,
  BackendStaticProductResponse,
  BackendBalanceAdjustResponse,
  BackendStaticOrderResponse,
  BackendUsdtOrderResponse,
} from './types';

const tokenCache = new NodeCache({
  stdTTL: 3000,
  checkperiod: 600,
});

const TOKEN_CACHE_KEY = 'backend_admin_token';
const REQUEST_TIMEOUT = 15_000;

async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${env.BACKEND_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const body = await response.json() as T;

    if (!response.ok) {
      const bdy = body as Record<string, unknown>;
      let msg =
        (bdy?.msg as string) ??
        (bdy?.message as string) ??
        response.statusText;

      if (bdy?.detail) {
        const d = bdy.detail;
        if (Array.isArray(d)) {
          msg = d
            .map((e: Record<string, unknown>) =>
              `${(e.loc as string[])?.join('.')}: ${e.msg}`
            )
            .join('; ');
        } else if (typeof d === 'string') {
          msg = d;
        } else if (typeof d === 'object') {
          msg = JSON.stringify(d);
        }
      }

      throw mapBackendError(
        response.status,
        msg
      );
    }

    const biz = body as Record<string, unknown>;
    if (
      typeof biz.code === 'number' &&
      biz.code !== 0 &&
      biz.code !== 200
    ) {
      throw mapBackendError(
        422,
        String(biz.msg ?? 'Backend business error')
      );
    }

    return body;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw mapBackendTimeout();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAdminToken(): Promise<string> {
  const cached = tokenCache.get<string>(TOKEN_CACHE_KEY);
  if (cached) return cached;

  const res = await fetchJson<
    BackendResponse<BackendLoginResponse>
  >('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: env.BACKEND_ADMIN_USERNAME,
      password: env.BACKEND_ADMIN_PASSWORD,
    }),
  });

  const token = res.data.token;
  tokenCache.set(TOKEN_CACHE_KEY, token);
  return token;
}

async function authHeaders(): Promise<
  Record<string, string>
> {
  const token = await getAdminToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getUserToken(
  username: string,
  password: string
): Promise<string> {
  const res = await fetchJson<
    BackendResponse<BackendLoginResponse>
  >('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return res.data.token;
}

export async function createBackendUser(
  username: string,
  password: string,
  email?: string,
  agentId?: number
): Promise<{
  id: number;
  username: string;
  agent_id?: number;
  agent_name?: string;
}> {
  const headers = await authHeaders();
  const payload: Record<string, unknown> = {
    username,
    password,
    email,
  };
  if (agentId !== undefined) {
    payload.agent_id = agentId;
  }
  const res = await fetchJson<
    BackendResponse<{
      id: number;
      username: string;
      agent_id?: number;
      agent_name?: string;
    }>
  >('/api/open/app/user/create/v2', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getBalance(
  userToken: string
): Promise<number> {
  const res = await fetchJson<
    BackendResponse<BackendBalanceResponse>
  >('/api/open/app/user/balance/current', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data.balance;
}

export async function getDynamicProducts(
  userToken: string
): Promise<BackendProductResponse[]> {
  const res = await fetchJson<
    BackendResponse<BackendProductResponse[]>
  >('/api/business/dynamic-proxy/products', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}

export interface PriceEntry {
  id: number;
  type: string;
  price: number;
  costPrice: number;
  globalPrice: number;
}

export async function getDynamicPrices(): Promise<
  PriceEntry[]
> {
  const headers = await authHeaders();
  const qs =
    'is_global=false&proxy_types=104';
  const res = await fetchJson<
    BackendResponse<PriceEntry[]>
  >(`/api/v1/product-prices/prices?${qs}`, {
    headers,
  });
  return res.data ?? [];
}

export async function getStaticProducts(
  userToken: string,
  params?: {
    proxyType?: number[];
    countryCode?: string;
    cityCode?: string;
  }
): Promise<BackendStaticProductResponse[]> {
  const res = await fetchJson<
    BackendResponse<BackendStaticProductResponse[]>
  >('/api/open/app/product/query/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      proxyType: params?.proxyType ?? [101, 102, 103],
      countryCode: params?.countryCode,
      cityCode: params?.cityCode,
    }),
  });
  return res.data;
}

export async function adjustUserBalance(
  userToken: string,
  userId: number,
  amount: number,
  remark?: string
): Promise<BackendBalanceAdjustResponse> {
  const res = await fetchJson<
    BackendResponse<BackendBalanceAdjustResponse>
  >(`/api/open/app/user/${userId}/balance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ amount, remark }),
  });
  return res.data;
}

export async function getAreaHierarchy(
  userToken: string
): Promise<BackendAreaHierarchyResponse> {
  const res = await fetchJson<
    BackendResponse<BackendAreaHierarchyResponse>
  >('/api/areas/hierarchy', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}

export interface OpenDynamicProxyParams {
  productNo: string;
  proxyType: number;
  flow: number;
  maxFlowLimit: number;
  username: string;
  userId: number;
  unitPrice: number;
  totalAmount: number;
  remark?: string;
}

export interface OpenDynamicResult {
  orderNo: string;
  username?: string;
  password?: string;
  host?: string;
  port?: string;
  proxy?: { url: string };
}

export async function openDynamicProxy(
  params: OpenDynamicProxyParams
): Promise<OpenDynamicResult> {
  const headers = await authHeaders();
  const res = await fetchJson<
    BackendResponse<OpenDynamicResult>
  >('/api/business/dynamic-proxy/open', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.data?.orderNo) {
    throw new Error(
      `Dynamic proxy open failed: ` +
        `${res.msg ?? JSON.stringify(res)}`
    );
  }
  return res.data;
}

export async function createDynamicOrderV2(
  userToken: string,
  params: CreateOrderParams
): Promise<{ order_no: string }> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/open/app/order/create/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      orderType: 'dynamic_proxy',
      poolId: params.poolId,
      trafficAmount: params.trafficAmount ?? 1,
      unitPrice: params.unitPrice,
      totalAmount: params.totalAmount,
      remark: params.remark ?? 'Agent dynamic session',
      userId: params.userId,
      ipCount: params.ipCount ?? 1,
      duration: params.duration || 30,
      unit: params.unit || 1,
    }),
  });

  if (!res.data) {
    throw new Error(
      `Dynamic order creation failed: ${res.msg}`
    );
  }

  const d = res.data as Record<string, unknown>;
  const orderNo =
    (d.order_no as string) ??
    (d.orderNo as string);
  if (!orderNo) {
    throw new Error(
      `Backend returned no dynamic order_no. ` +
        `Keys: ${Object.keys(d).join(',')}`
    );
  }
  return { order_no: orderNo };
}

export async function extractDynamicProxy(
  userToken: string,
  params: {
    productNo: string;
    proxyType: number;
    username: string;
    protocol: string;
    quantity: number;
    validTime: number;
    countryCode?: string;
    cityCode?: string;
  }
): Promise<Record<string, unknown>> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/business/dynamic-proxy/extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      productNo: params.productNo,
      proxyType: params.proxyType,
      username: params.username,
      extractConfig: {
        method: 'password',
        protocol: params.protocol,
        dataFormat: 'txt',
        delimiter: 1,
        quantity: params.quantity,
        validTime: params.validTime,
        timeMode: 'specified',
        ipwebCountry: params.countryCode || undefined,
        ipwebCity: params.cityCode || undefined,
      },
    }),
  });
  return res.data;
}

export interface CreateOrderParams {
  orderType: 'dynamic_proxy' | 'static_proxy';
  poolId: string;
  userId: number;
  unitPrice: number;
  totalAmount: number;
  trafficAmount?: number;
  ipCount?: number;
  duration: number;
  unit: number;
  cycleTimes?: number;
  countryCode?: string;
  cityCode?: string;
  remark?: string;
}

export async function createStaticOrderV2(
  userToken: string,
  params: CreateOrderParams
): Promise<{ order_no: string }> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/open/app/static/order/create/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      orderType: 'static_proxy',
      poolId: params.poolId,
      userId: params.userId,
      unitPrice: params.unitPrice,
      totalAmount: params.totalAmount,
      ipCount: params.ipCount ?? 1,
      duration: params.duration,
      unit: params.unit,
      cycleTimes: params.cycleTimes ?? 1,
      countryCode: params.countryCode,
      cityCode: params.cityCode,
      remark: params.remark ?? 'Agent session',
      extBandWidth: 0,
      bandWidthPrice: 0,
      bridgePrice: 0,
      renew: false,
    }),
  });

  if (!res.data) {
    throw new Error(
      `Static order creation failed: ${res.msg}`
    );
  }

  const d = res.data as Record<string, unknown>;
  const orderNo =
    (d.order_no as string) ??
    (d.orderNo as string);
  if (!orderNo) {
    throw new Error(
      `Backend returned no order_no. ` +
        `Keys: ${Object.keys(d).join(',')}`
    );
  }
  return { order_no: orderNo };
}

export async function createStaticOrder(
  userToken: string,
  params: CreateOrderParams
): Promise<BackendStaticOrderResponse> {
  const result = await createStaticOrderV2(
    userToken,
    params
  );
  return {
    order_no: result.order_no,
    status: 'active',
  };
}

export async function refreshProxy(
  orderNo: string
): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >(`/api/open/app/proxy/refresh/v2/${orderNo}`, {
    method: 'POST',
    headers,
  });
  return res.data;
}

export async function getStaticOrders(
  userToken: string,
  params: { page?: number; page_size?: number }
): Promise<{
  items: BackendStaticOrderResponse[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) {
    qs.set('page_size', String(params.page_size));
  }

  const res = await fetchJson<
    BackendResponse<{
      items: BackendStaticOrderResponse[];
      total: number;
    }>
  >(`/api/open/app/static/order/list/v2?${qs}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}

export async function createUsdtRechargeOrder(
  userToken: string,
  amount: number
): Promise<BackendUsdtOrderResponse> {
  const res = await fetchJson<
    BackendResponse<BackendUsdtOrderResponse>
  >('/api/usdt/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ amount }),
  });
  return res.data;
}

export async function checkUsdtOrderStatus(
  userToken: string,
  orderId: string
): Promise<BackendUsdtOrderResponse> {
  const res = await fetchJson<
    BackendResponse<BackendUsdtOrderResponse>
  >(`/api/usdt/check-status?order_id=${orderId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}

export async function getDashboardInfo(
  userToken: string
): Promise<Record<string, unknown>> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/open/app/dashboard/info/v2', {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}

export async function addIpWhitelist(
  userToken: string,
  orderNo: string,
  ips: string[]
): Promise<Record<string, unknown>> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/open/app/proxy/addIpWhiteList/v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ order_no: orderNo, ips }),
  });
  return res.data;
}

export async function getStaticOrderDetail(
  userToken: string,
  orderNo: string
): Promise<Record<string, unknown>> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >(
    `/api/open/app/static/order/${orderNo}/v2`,
    {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    }
  );
  return res.data;
}

export interface RenewStaticParams {
  userId: number;
  orderNo: string;
  productNo: string;
  duration: number;
  country?: string;
  city?: string;
  region?: string;
  staticType?: string;
}

export async function renewStaticOrder(
  params: RenewStaticParams
): Promise<Record<string, unknown>> {
  const headers = await authHeaders();
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >(`/api/open/app/user/${params.userId}/renew`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      proxyType: 'static',
      orderNo: params.orderNo,
      product_no: params.productNo,
      quantity: 1,
      duration: params.duration,
      region: params.region ?? '',
      country: params.country ?? '',
      city: params.city ?? '',
      staticType: params.staticType ?? 'isp',
      remark: '续费 - Agent自动续费',
    }),
  });
  return res.data;
}

export async function getTransactions(
  userToken: string,
  params: { page?: number; page_size?: number }
): Promise<{
  items: Record<string, unknown>[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) {
    qs.set('page_size', String(params.page_size));
  }
  const res = await fetchJson<
    BackendResponse<{
      items: Record<string, unknown>[];
      total: number;
    }>
  >(`/api/open/app/user/transactions?${qs}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return res.data;
}
