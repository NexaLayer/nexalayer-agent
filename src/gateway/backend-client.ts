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
  BackendUsdtRateResponse,
} from './types';
import {
  dynamicProductName,
  toBackendDynamicProductNo,
  toPublicDynamicProductNo,
} from './dynamic-product';

const tokenCache = new NodeCache({
  stdTTL: 3000,
  checkperiod: 600,
});

const TOKEN_CACHE_KEY = 'backend_admin_token';
const REQUEST_TIMEOUT = Number(
  process.env.BACKEND_REQUEST_TIMEOUT_MS ?? 180_000
);

type StandardProductItem = Record<string, unknown>;
type BackendUserSummary = {
  id: number;
  username: string;
  agent_id?: number;
  agent_name?: string;
};

function asArrayData<T>(
  data: T[] | { items?: T[]; list?: T[] } | null | undefined
): T[] {
  if (Array.isArray(data)) return data;
  return data?.items ?? data?.list ?? [];
}

async function queryStandardProducts(
  userToken: string,
  params: {
    proxyType: number;
    countryCode?: string;
    cityCode?: string;
    language?: 'zh' | 'en';
  }
): Promise<StandardProductItem[]> {
  const res = await fetchJson<
    BackendResponse<
      | StandardProductItem[]
      | {
          items?: StandardProductItem[];
          list?: StandardProductItem[];
        }
    >
  >('/api/open/app/product/query-standard/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      proxyType: params.proxyType,
      standardCountryCode: params.countryCode,
      standardCityCode: params.cityCode,
      countryCode: params.countryCode,
      cityCode: params.cityCode,
      language: params.language ?? 'en',
    }),
  });
  return asArrayData(res.data);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBackendUser(
  raw: unknown,
  fallbackUsername: string
): BackendUserSummary | null {
  const root = raw as Record<string, unknown> | null;
  if (!root) return null;
  const data =
    (root.data as Record<string, unknown> | undefined) ??
    (root.user as Record<string, unknown> | undefined) ??
    root;
  const candidate =
    (data.user as Record<string, unknown> | undefined) ??
    (data.item as Record<string, unknown> | undefined) ??
    data;
  const id = num(
    candidate.id ??
      candidate.user_id ??
      candidate.userId ??
      data.id ??
      data.user_id ??
      data.userId
  );
  const username = String(
    candidate.username ?? data.username ?? fallbackUsername
  );
  if (!id || !username) return null;
  const agentId = num(
    candidate.agent_id ??
      candidate.agentId ??
      data.agent_id ??
      data.agentId
  );
  const agentName =
    (candidate.agent_name as string | undefined) ??
    (candidate.agentName as string | undefined) ??
    (data.agent_name as string | undefined) ??
    (data.agentName as string | undefined);
  return {
    id,
    username,
    agent_id: agentId || undefined,
    agent_name: agentName,
  };
}

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

export async function getUserIdentity(
  username: string,
  password: string
): Promise<{ token: string; agentId?: number }> {
  const res = await fetchJson<BackendResponse<BackendLoginResponse>>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ username, password }) }
  );
  const raw = res.data.user as BackendLoginResponse['user'] & {
    agent_id?: number;
    agentId?: number;
  };
  const agentId = num(raw.agent_id ?? raw.agentId);
  return { token: res.data.token, agentId: agentId || undefined };
}

export async function createBackendUser(
  username: string,
  password: string,
  email?: string,
  agentId?: number,
  initialBalanceUsd = 0
): Promise<BackendUserSummary> {
  const headers = await authHeaders();
  const adminToken = await getAdminToken();
  const rate = initialBalanceUsd > 0
    ? await getUsdtRate(adminToken)
    : undefined;
  const usdCnyRate = Number(
    rate?.effective_rate ?? rate?.rate ?? 0
  );
  if (
    initialBalanceUsd > 0 &&
    (!Number.isFinite(usdCnyRate) || usdCnyRate <= 0)
  ) {
    throw new Error(
      'Cannot create trial account: exchange rate is unavailable'
    );
  }
  const initialBalanceCny = initialBalanceUsd > 0
    ? Math.round(initialBalanceUsd * usdCnyRate * 100) / 100
    : 0;
  const payload: Record<string, unknown> = {
    username,
    password,
    email,
    // Initial trial credit is applied as part of the unique backend-user
    // creation call. Retrying an API-key request only resends the same key and
    // therefore cannot grant credit twice.
    balance: initialBalanceCny,
  };
  if (agentId !== undefined) {
    payload.agent_id = agentId;
  }
  const request = {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  };
  let created: BackendUserSummary | null = null;
  let firstError: unknown;

  try {
    const res = await fetchJson<BackendResponse>(
      '/api/open/app/user/v2',
      request
    );
    created =
      normalizeBackendUser(res, username) ??
      (await findBackendUserByUsername(headers, username));
  } catch (err) {
    firstError = err;
  }

  if (!created) {
    try {
      const legacy = await fetchJson<BackendResponse>(
        '/api/open/app/user/create/v2',
        request
      );
      created =
        normalizeBackendUser(legacy, username) ??
        (await findBackendUserByUsername(headers, username));
    } catch (err) {
      if (!firstError) firstError = err;
    }
  }

  if (!created) {
    throw new Error(
      `Backend user sync failed: ${
        firstError instanceof Error
          ? firstError.message
          : 'response did not include user id and lookup by username failed'
      }`
    );
  }
  return created;
}

async function findBackendUserByUsername(
  headers: Record<string, string>,
  username: string
): Promise<BackendUserSummary | null> {
  const qs = new URLSearchParams({
    page: '1',
    pageSize: '5',
    search: username,
  });
  const res = await fetchJson<
    BackendResponse<{
      items?: Record<string, unknown>[];
      list?: Record<string, unknown>[];
    }>
  >(`/api/open/app/agent/sub-users?${qs}`, {
    headers,
  }).catch(() => null);
  const users = res?.data?.items ?? res?.data?.list ?? [];
  const match =
    users.find(
      (u) =>
        String(u.username ?? '').toLowerCase() ===
        username.toLowerCase()
    ) ?? users[0];
  return match
    ? normalizeBackendUser({ data: match }, username)
    : null;
}

export async function getBackendUserOwner(
  username: string
): Promise<{ userId: number; agentId?: number; agentName?: string }> {
  const user = await findBackendUserByUsername(await authHeaders(), username);
  if (!user) {
    throw new Error(`Backend pricing user not found: ${username}`);
  }
  return {
    userId: user.id,
    agentId: user.agent_id,
    agentName: user.agent_name,
  };
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
  const items = await queryStandardProducts(userToken, {
    proxyType: 104,
  });
  return items.flatMap((p) => {
    const productNo = String(
      p.productId ?? p.product_no ?? p.type ?? ''
    );
    const publicProductNo =
      toPublicDynamicProductNo(productNo);
    if (!publicProductNo) return [];
    return [{
      id: num(p.id),
      type: publicProductNo,
      backendProductNo:
        toBackendDynamicProductNo(publicProductNo)!,
      name: dynamicProductName(publicProductNo),
      proxyType: num(p.proxyType, 104),
      price: num(p.price),
      unit: num(p.unit, 1),
      flow: num(p.flow ?? p.trafficAmount, 1),
      duration: num(p.duration, 30),
      country: String(
        p.countryCode ?? p.country ?? ''
      ),
      city: String(p.cityCode ?? p.city ?? ''),
      isGlobal: Boolean(p.isGlobal ?? p.is_global),
      stock: num(p.stock ?? p.inventory),
    }];
  });
}

export interface PriceEntry {
  id: number;
  type: string;
  price: number;
  costPrice: number;
  globalPrice: number;
}

export async function getAgentProductPrices(
  agentId: number,
  proxyTypes: number[] = [103, 104]
): Promise<
  PriceEntry[]
> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({
    is_global: 'false',
    agent_id: String(agentId),
  });
  for (const proxyType of proxyTypes) {
    qs.append('proxy_types', String(proxyType));
  }
  const res = await fetchJson<
    BackendResponse<PriceEntry[]>
  >(`/api/v1/product-prices/prices?${qs.toString()}`, {
    headers,
  });
  return res.data ?? [];
}

export async function getDynamicPrices(): Promise<PriceEntry[]> {
  return getAgentProductPrices(env.PRICING_OWNER_AGENT_ID, [104]);
}

export async function getStaticProducts(
  userToken: string,
  params?: {
    proxyType?: number[];
    countryCode?: string;
    cityCode?: string;
  }
): Promise<BackendStaticProductResponse[]> {
  const proxyTypes = params?.proxyType?.length
    ? params.proxyType
    : [103];
  const batches = await Promise.all(
    proxyTypes.map((proxyType) =>
      queryStandardProducts(userToken, {
        proxyType,
        countryCode: params?.countryCode,
        cityCode: params?.cityCode,
      })
    )
  );
  return batches.flat().map((p) => {
    const productId = String(
      p.productId ?? p.product_no ?? p.type ?? ''
    );
    const projectList =
      p.project_list ??
      p.projects ??
      p.projectList;
    return {
      id: num(p.id),
      productId,
      name: String(p.name ?? productId),
      proxyType: num(p.proxyType, 103),
      productType:
        (p.product_type as number | string | undefined) ??
        (p.productType as number | string | undefined),
      price: num(p.price),
      stock: num(p.stock ?? p.inventory),
      area: String(p.area ?? p.areaCode ?? ''),
      country: String(
        p.countryCode ?? p.country ?? ''
      ),
      city: String(p.cityCode ?? p.city ?? ''),
      flow:
        p.flow === undefined
          ? undefined
          : num(p.flow),
      duration: num(p.duration, 30),
      unit: num(p.unit, 1),
      supplierCode:
        (p.supplierCode as string | undefined) ??
        (p.supplier_code as string | undefined),
      status: num(p.status, 1),
      minAgentPrice:
        p.minAgentPrice === undefined
          ? undefined
          : num(p.minAgentPrice),
      projectList: Array.isArray(projectList)
        ? (projectList as Record<string, unknown>[])
        : undefined,
    };
  });
}

export async function adjustUserBalance(
  userToken: string,
  userId: number,
  amount: number,
  remark?: string
): Promise<BackendBalanceAdjustResponse> {
  const res = await fetchJson<
    BackendResponse<BackendBalanceAdjustResponse>
  >(`/api/open/app/agent/sub-users/${userId}/balance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ amount, remark }),
  });
  return res.data;
}

export async function refundUserBalance(
  userId: number,
  amount: number,
  remark: string
): Promise<BackendBalanceAdjustResponse> {
  return adjustUserBalance(await getAdminToken(), userId, amount, remark);
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

export async function openDynamicProxy(
  userToken: string,
  params: {
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
): Promise<{
  order_no: string;
  payload: Record<string, unknown>;
}> {
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/business/dynamic-proxy/open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      productNo: params.productNo,
      proxyType: params.proxyType,
      flow: params.flow,
      maxFlowLimit: params.maxFlowLimit,
      username: params.username,
      userId: params.userId,
      unitPrice: params.unitPrice,
      totalAmount: params.totalAmount,
      remark: params.remark ?? 'Agent dynamic session',
    }),
  });

  if (!res.data) {
    throw new Error(
      `Dynamic proxy open failed: ${res.msg}`
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
  return {
    order_no: orderNo,
    payload: d,
  };
}

export async function extractDynamicProxy(
  userToken: string,
  params: {
    productNo: string;
    proxyType: number;
    username?: string;
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
      username: params.username || undefined,
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
  projectId?: string;
  remark?: string;
}

export async function createStaticOrderV2(
  userToken: string,
  params: CreateOrderParams
): Promise<{
  order_no: string;
  payload: Record<string, unknown>;
}> {
  const request = {
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
      projectId: params.projectId,
      remark: params.remark ?? 'Agent session',
      extBandWidth: 0,
      bandWidthPrice: 0,
      bridgePrice: 0,
      renew: false,
    }),
  };
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >(
    '/api/open/app/static/order/create-standard/v2',
    request
  ).catch(() =>
    fetchJson<BackendResponse<Record<string, unknown>>>(
      '/api/open/app/static/order/create/v2',
      request
    )
  );

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
  return { order_no: orderNo, payload: d };
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

export async function getStaticOrders(
  userToken: string,
  params: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
  }
): Promise<{
  items: BackendStaticOrderResponse[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) {
    qs.set('pageSize', String(params.page_size));
  }
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);

  const res = await fetchJson<
    BackendResponse<{
      items: BackendStaticOrderResponse[];
      list?: BackendStaticOrderResponse[];
      total: number;
    }>
  >(`/api/open/app/static/order/list/v2?${qs}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return {
    items: res.data.items ?? res.data.list ?? [],
    total: res.data.total ?? 0,
  };
}

export async function createUsdtRechargeOrder(
  userToken: string,
  amountCny: number
): Promise<BackendUsdtOrderResponse> {
  const res = await fetchJson<
    BackendResponse<BackendUsdtOrderResponse>
  >('/api/usdt/create-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ amount_cny: amountCny }),
  });
  return res.data;
}

export async function getUsdtRate(
  userToken: string
): Promise<BackendUsdtRateResponse> {
  const res = await fetchJson<
    BackendResponse<BackendUsdtRateResponse>
  >('/api/settings/usdt-rate', {
    headers: { Authorization: `Bearer ${userToken}` },
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

export async function releaseZtProxyStaticOrder(
  orderNo: string
): Promise<Record<string, unknown>> {
  const adminToken = await getAdminToken();
  const res = await fetchJson<
    BackendResponse<Record<string, unknown>>
  >('/api/release-ztproxy-orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      orderNos: [orderNo],
      refund: false,
    }),
  });
  const data = res.data ?? {};
  const results = (
    data.results ??
    data.items ??
    []
  ) as Array<Record<string, unknown>>;
  if (Array.isArray(results) && results.length > 0) {
    const target =
      results.find(
        (r) =>
          r.orderNo === orderNo ||
          r.order_no === orderNo
      ) ?? results[0];
    if (target.success !== true) {
      throw new Error(
        `Static release failed for ${orderNo}: ` +
          `${String(target.msg ?? target.message ?? 'unknown')}`
      );
    }
  }
  return data;
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
  >('/api/open/app/static/order/renew', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      order_no: params.orderNo,
      duration: params.duration,
      unit: 3,
      cycleTimes: 1,
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
