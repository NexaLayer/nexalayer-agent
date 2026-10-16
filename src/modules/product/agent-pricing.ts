import { env } from '../../config/env';
import * as backend from '../../gateway/backend-client';

type PriceableProduct = {
  id: number;
  productNo: string;
};

export async function getOpenAgentPriceMap(
  proxyTypes: number[] = [103, 104]
): Promise<Map<number, number>> {
  const prices = await backend.getAgentProductPrices(
    env.PRICING_OWNER_AGENT_ID,
    proxyTypes
  );
  return new Map(
    prices
      .filter((entry) => entry.id > 0 && entry.price > 0)
      .map((entry) => [entry.id, entry.price])
  );
}

export function resolveOpenAgentPrice(
  product: PriceableProduct,
  prices: Map<number, number>
): number {
  const price = prices.get(product.id);
  if (!price || price <= 0) {
    throw new Error(
      `No openAgent price for product ${product.productNo} (id=${product.id}). Configure the reseller price first.`
    );
  }
  return price;
}

export function findOpenAgentPrice(
  productId: number,
  prices: Map<number, number>
): number | undefined {
  const price = prices.get(productId);
  return price && price > 0 ? price : undefined;
}
