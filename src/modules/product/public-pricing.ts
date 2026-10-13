import pricing from '../../config/public-pricing.json';

const EXACT_PRICING_URL = 'https://docs.nexalayer.net/en/api/products';

export function getPublicPricing() {
  return {
    currency: pricing.currency,
    updated_at: pricing.updated_at,
    items: [
      {
        type: 'dynamic',
        name: 'Dynamic proxy',
        starting_price: pricing.products.dynamic.starting_price,
        unit: pricing.products.dynamic.unit,
        price_qualifier: 'starting_at',
      },
      {
        type: 'static',
        name: 'Static proxy',
        starting_price: pricing.products.static.starting_price,
        unit: pricing.products.static.unit,
        price_qualifier: 'starting_at',
      },
    ],
    exact_pricing_url: EXACT_PRICING_URL,
  };
}
