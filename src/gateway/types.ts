export interface BackendLoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    balance: number;
    is_admin: boolean;
    is_agent: boolean;
    status: string;
  };
}

export interface BackendUserCreateRequest {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface BackendUserCreateResponse {
  id: number;
  username: string;
  email?: string;
}

export interface BackendBalanceResponse {
  balance: number;
}

export interface BackendProductResponse {
  id: number;
  type: string;
  name: string;
  proxyType: number;
  price: number;
  unit: number;
  flow: number;
  duration: number;
  country: string;
  city: string;
  isGlobal: boolean;
  stock: number;
}

export interface BackendOrderCreateResponse {
  order_no: string;
  status: string;
}

export interface BackendProxyInfoResponse {
  ip: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
}

export interface BackendStaticOrderResponse {
  order_no: string;
  status: string;
  proxy_info?: BackendProxyInfoResponse;
  expire_time?: string;
}

export interface BackendDynamicOpenResponse {
  order_no: string;
  extract_url?: string;
  status: string;
}

export interface BackendAreaItem {
  areaCode: string;
  areaName: string;
  countries: BackendCountryItem[];
}

export interface BackendCountryItem {
  countryCode: string;
  countryName: string;
  areaCode: string;
  cities: BackendCityItem[];
}

export interface BackendCityItem {
  cityCode: string;
  cityName: string;
  countryCode: string;
}

export interface BackendAreaHierarchyResponse {
  areas: BackendAreaItem[];
  countries: BackendCountryItem[];
  cities: BackendCityItem[];
}

export interface BackendUsdtOrderResponse {
  order_id: string;
  amount: number;
  status: string;
  pay_url?: string;
}

export interface BackendStaticProductResponse {
  productId: string;
  name: string;
  proxyType: number;
  productType?: number | string;
  price: number;
  stock: number;
  area?: string;
  country?: string;
  city?: string;
  flow?: number;
  duration?: number;
  unit?: number;
  supplierCode?: string;
  status: number;
  minAgentPrice?: number;
  projectList?: Record<string, unknown>[];
}

export interface BackendBalanceAdjustResponse {
  id: number;
  username: string;
  balance: number;
  updated_at: string;
}

export interface BackendResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}
