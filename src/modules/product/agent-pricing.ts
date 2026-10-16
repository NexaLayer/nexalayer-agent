import { env } from '../../config/env';
import * as backend from '../../gateway/backend-client';

type PriceableProduct = {
  id: number;
  productNo: string;
  aliases?: string[];
};

export type OpenAgentPriceMap = Map<string, number>;

export async function getOpenAgentPriceMap(
  proxyTypes: number[] = [103, 104]
): Promise<OpenAgentPriceMap> {
  const prices = await backend.getAgentProductPrices(
    env.PRICING_OWNER_AGENT_ID,
    proxyTypes
  );
  const result: OpenAgentPriceMap = new Map();
  for (const entry of prices) {
    if (entry.price <= 0) continue;
    if (entry.id > 0) result.set(`id:${entry.id}`, entry.price);
    if (entry.type) result.set(`product:${entry.type}`, entry.price);
  }
  return result;
}

export function resolveOpenAgentPrice(
  product: PriceableProduct,
  prices: OpenAgentPriceMap
): number {
  const price = findOpenAgentPrice(
    product.id,
    [product.productNo, ...(product.aliases ?? [])],
    prices
  );
  if (!price || price <= 0) {
    throw new Error(
      `No openAgent price for product ${product.productNo} (id=${product.id}). Configure the reseller price first.`
    );
  }
  return price;
}

export function findOpenAgentPrice(
  productId: number,
  productNos: string[],
  prices: OpenAgentPriceMap
): number | undefined {
  if (productId > 0) {
    const byId = prices.get(`id:${productId}`);
    if (byId && byId > 0) return byId;
  }
  for (const productNo of productNos) {
    const byProductNo = prices.get(`product:${productNo}`);
    if (byProductNo && byProductNo > 0) return byProductNo;
  }
  return undefined;
}
