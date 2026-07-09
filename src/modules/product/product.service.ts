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

  const products: {
    product_no: string;
    name: string;
    type: string;
    proxy_type?: number;
    price: number;
    unit: string;
    stock?: number;
    country?: string;
    city?: string;
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
        price: p.price,
        unit: p.flow > 0 ? 'MB' : 'request',
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
        price: p.price,
        unit: 'piece',
        stock: p.stock,
        country: p.country,
        city: p.city,
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
