import NodeCache from 'node-cache';
import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { env } from '../../config/env';
import * as backend from '../../gateway/backend-client';
import type { ListProductsQuery } from './product.schema';
import {
  getOpenAgentPriceMap,
  findOpenAgentPrice,
} from './agent-pricing';

const productCache = new NodeCache({
  stdTTL: env.PRODUCT_CACHE_TTL_SECONDS,
  checkperiod: env.PRODUCT_CACHE_TTL_SECONDS,
  useClones: true,
});

export type ProductListItem = {
  product_no: string;
  name: string;
  type: 'dynamic' | 'static';
  sharing: 'exclusive' | 'shared';
  available: boolean;
  price: number;
  currency: 'USD';
  unit: string;
  country?: string;
  city?: string;
  stock?: number;
  proxy_type?: number;
  product_type?: number | string;
  project_required?: boolean;
  projects?: Record<string, unknown>[];
};

async function getPricingToken(): Promise<string> {
  const agent = await prisma.agentApp.findUnique({
    where: { id: env.PRICING_AGENT_APP_ID },
  });
  if (!agent?.backendUsername || !agent.backendPasswordEnc) {
    throw new AppError(ERROR_CODES.BACKEND_ERROR, 'Pricing account is not configured');
  }
  const identity = await backend.getUserIdentity(
    agent.backendUsername,
    decrypt(agent.backendPasswordEnc)
  );
  const owner = identity.agentId === undefined
    ? await backend.getBackendUserOwner(agent.backendUsername)
    : { agentId: identity.agentId };
  if (owner.agentId !== env.PRICING_OWNER_AGENT_ID) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Pricing account owner does not match the configured reseller'
    );
  }
  return identity.token;
}

function englishStaticName(product: {
  country?: string;
  city?: string;
  productType?: number | string;
}): string {
  const location = [product.city, product.country]
    .filter((part): part is string => Boolean(part && /^[\x20-\x7E]+$/.test(part)))
    .join(', ');
  const sharing = product.productType === 2 || product.productType === '2'
    ? 'Shared'
    : 'Exclusive';
  return `${location ? `${location} ` : ''}${sharing} Static Proxy`;
}

async function loadCatalog(): Promise<ProductListItem[]> {
  const cached = productCache.get<ProductListItem[]>('open-agent-catalog');
  if (cached) return cached;

  const userToken = await getPricingToken();
  const [rate, dynamicProducts, staticProducts, agentPrices] = await Promise.all([
    backend.getUsdtRate(userToken),
    backend.getDynamicProducts(userToken),
    backend.getStaticProducts(userToken),
    getOpenAgentPriceMap(),
  ]);
  const exchangeRate = Number(rate.effective_rate ?? rate.rate);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new AppError(ERROR_CODES.BACKEND_ERROR, 'Backend exchange rate is unavailable');
  }
  const usd = (priceCny: number) =>
    Math.round((priceCny / exchangeRate) * 100) / 100;

  const items: ProductListItem[] = [
    ...dynamicProducts.flatMap((product) => {
      const price = findOpenAgentPrice(product.id, agentPrices);
      if (price === undefined) return [];
      return [{
      product_no: product.type,
      name: product.name,
      type: 'dynamic' as const,
      sharing: 'shared' as const,
      available: product.flow > 0,
      price: usd(price),
      currency: 'USD' as const,
      unit: 'GB',
      country: product.country || undefined,
      city: product.city || undefined,
      proxy_type: product.proxyType,
      }];
    }),
    ...staticProducts.flatMap((product) => {
      const price = findOpenAgentPrice(product.id, agentPrices);
      if (price === undefined) return [];
      return [{
      product_no: product.productId,
      name: englishStaticName(product),
      type: 'static' as const,
      sharing: product.productType === 2 || product.productType === '2'
        ? 'shared' as const
        : 'exclusive' as const,
      available: product.status === 1 && product.stock > 0,
      price: usd(price),
      currency: 'USD' as const,
      unit: 'month',
      stock: product.stock,
      country: product.country || undefined,
      city: product.city || undefined,
      proxy_type: product.proxyType,
      product_type: product.productType,
      project_required: Boolean(product.projectList?.length),
      projects: product.projectList,
      }];
    }),
  ];
  productCache.set('open-agent-catalog', items);
  return items;
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const value = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Number.isInteger(value) && value >= 0) return value;
  } catch {
    // Converted to a public validation error below.
  }
  throw new AppError(ERROR_CODES.INVALID_REQUEST, 'Invalid product cursor');
}

export async function listProducts(query: ListProductsQuery) {
  const country = (query.country ?? query.country_code)?.toLowerCase();
  const filtered = (await loadCatalog()).filter((product) => {
    if (query.type !== 'all' && product.type !== query.type) return false;
    if (query.in_stock && !product.available) return false;
    if (
      country &&
      ![product.country, product.city]
        .filter(Boolean)
        .some((value) => value!.toLowerCase() === country)
    ) return false;
    return true;
  });
  const offset = decodeCursor(query.cursor);
  const items = filtered.slice(offset, offset + query.limit);
  const nextOffset = offset + items.length;
  return {
    items,
    next_cursor:
      nextOffset < filtered.length
        ? Buffer.from(String(nextOffset)).toString('base64url')
        : null,
    total: filtered.length,
    cache_ttl_seconds: env.PRODUCT_CACHE_TTL_SECONDS,
    pricing_owner_agent_id: env.PRICING_OWNER_AGENT_ID,
  };
}

export async function listRegions(_agentId: number) {
  const hierarchy = await backend.getAreaHierarchy(await getPricingToken());
  const items = hierarchy.areas.map((area) => ({
    code: area.areaCode,
    name: area.areaName,
    countries: area.countries.map((country) => ({
      code: country.countryCode,
      name: country.countryName,
      cities: country.cities.map((city) => ({
        code: city.cityCode,
        name: city.cityName,
      })),
    })),
  }));
  return { items };
}

export function clearProductCacheForTests(): void {
  productCache.flushAll();
}
