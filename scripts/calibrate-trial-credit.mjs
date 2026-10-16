const pricingUrl = process.env.PUBLIC_PRODUCTS_URL ??
  'https://api.nexalayer.net/v1/public/products?type=dynamic&in_stock=true&limit=100';
const response = await fetch(pricingUrl);
if (!response.ok) throw new Error(`Unable to read public products: HTTP ${response.status}`);
const products = (await response.json())?.data?.items ?? [];
const dynamic = products
  .filter((product) => product.type === 'dynamic' && product.available)
  .sort((a, b) => Number(a.price) - Number(b.price))[0];
if (!dynamic) throw new Error('No available dynamic product was returned');
// Fractional orders are accepted by the control plane but do not yield usable
// Dynamic Pool 2 quota. Production regression verifies 1 GB as the minimum
// useful test Session.
const testQuantityGb = 1;
const targetSessions = { minimum: 5, maximum: 10 };
const perSessionUsd = Number(dynamic.price) * testQuantityGb;
const recommended = {
  minimum_usd: Number((perSessionUsd * targetSessions.minimum).toFixed(2)),
  maximum_usd: Number((perSessionUsd * targetSessions.maximum).toFixed(2)),
};

if (perSessionUsd <= 0 || recommended.minimum_usd <= 0) {
  throw new Error('Trial calibration produced an invalid result');
}

console.log(JSON.stringify({
  basis: {
    public_dynamic_starting_price_usd_per_gb:
      Number(dynamic.price),
    test_session_quantity_gb: testQuantityGb,
    test_session_cost_usd: perSessionUsd,
  },
  target_sessions: targetSessions,
  recommended_trial_credit: recommended,
  selected_default_usd: recommended.minimum_usd,
}, null, 2));
