import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import * as backend from '../../gateway/backend-client';

async function getAgentBackendToken(
  agentId: number
): Promise<string> {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });

  if (
    !agent?.backendUsername ||
    !agent.backendPasswordEnc
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend credentials not configured'
    );
  }

  const password = decrypt(agent.backendPasswordEnc);
  return backend.getUserToken(
    agent.backendUsername,
    password
  );
}

export async function listProducts(
  agentId: number,
  type: string,
  countryCode?: string
) {
  const userToken =
    await getAgentBackendToken(agentId);
  const rate = await backend.getUsdtRate(userToken);
  const exchangeRate = Number(
    rate.effective_rate ?? rate.rate
  );
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend exchange rate is unavailable'
    );
  }
  const usd = (priceCny: number) =>
    Math.round((priceCny / exchangeRate) * 10_000) /
    10_000;

  const products: {
    product_no: string;
    name: string;
    type: string;
    proxy_type?: number;
    price: number;
    price_cny?: number;
    currency?: string;
    exchange_rate?: number;
    unit: string;
    stock?: number;
    country?: string;
    city?: string;
    product_type?: number | string;
    project_required?: boolean;
    projects?: Record<string, unknown>[];
  }[] = [];

  if (type === 'all' || type === 'dynamic') {
    const dynamicProducts =
      await backend.getDynamicProducts(userToken);
    for (const p of dynamicProducts) {
      products.push({
        product_no: p.type,
        name: p.name || p.type,
        type: 'dynamic',
        proxy_type: p.proxyType,
        price: usd(p.price),
        price_cny: p.price,
        currency: 'USD',
        exchange_rate: exchangeRate,
        unit: 'GB',
        country: p.country || undefined,
        city: p.city || undefined,
      });
    }
  }

  if (type === 'all' || type === 'static') {
    const staticProducts =
      await backend.getStaticProducts(userToken, {
        countryCode,
      });
    for (const p of staticProducts) {
      products.push({
        product_no: p.productId,
        name: p.name,
        type: 'static',
        proxy_type: p.proxyType,
        product_type: p.productType,
        price: usd(p.price),
        price_cny: p.price,
        currency: 'USD',
        exchange_rate: exchangeRate,
        unit: 'month',
        stock: p.stock,
        country: p.country,
        city: p.city,
        project_required: Boolean(
          p.projectList?.length
        ),
        projects: p.projectList,
      });
    }
  }

  return { items: products, total: products.length };
}

export async function listRegions(agentId: number) {
  const userToken =
    await getAgentBackendToken(agentId);
  const hierarchy = await backend.getAreaHierarchy(
    userToken
  );
  const items = hierarchy.areas.map((a) => ({
    code: a.areaCode,
    name: a.areaName,
    countries: a.countries.map((c) => ({
      code: c.countryCode,
      name: c.countryName,
      cities: c.cities.map((ci) => ({
        code: ci.cityCode,
        name: ci.cityName,
      })),
    })),
  }));
  return { items };
}
