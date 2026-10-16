const canonicalUrl = process.env.PUBLIC_PRODUCTS_URL ??
  'https://api.nexalayer.net/v1/public/products?type=all&in_stock=false&limit=100';
const response = await fetch(canonicalUrl);
if (!response.ok) {
  throw new Error(`Unable to read canonical public pricing: HTTP ${response.status}`);
}
const canonical = await response.json();
if (!Array.isArray(canonical?.data?.items)) {
  throw new Error('Public products response has no items array');
}
console.log('Agent public pricing endpoint returned the expected shape');
