import { readFile } from 'node:fs/promises';

const pricing = JSON.parse(
  await readFile(new URL('../src/config/public-pricing.json', import.meta.url), 'utf8')
);
// Fractional orders are accepted by the control plane but do not yield usable
// Dynamic Pool 2 quota. Production regression verifies 1 GB as the minimum
// useful test Session.
const testQuantityGb = 1;
const targetSessions = { minimum: 5, maximum: 10 };
const perSessionUsd = pricing.products.dynamic.starting_price * testQuantityGb;
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
      pricing.products.dynamic.starting_price,
    test_session_quantity_gb: testQuantityGb,
    test_session_cost_usd: perSessionUsd,
  },
  target_sessions: targetSessions,
  recommended_trial_credit: recommended,
  selected_default_usd: recommended.minimum_usd,
}, null, 2));
