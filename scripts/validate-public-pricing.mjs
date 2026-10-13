import { readFile } from 'node:fs/promises';

const local = JSON.parse(
  await readFile(new URL('../src/config/public-pricing.json', import.meta.url), 'utf8')
);
const canonicalUrl =
  'https://raw.githubusercontent.com/NexaLayer/nexalayer-docs/main/public-pricing.json';
const response = await fetch(canonicalUrl);
if (!response.ok) {
  throw new Error(`Unable to read canonical public pricing: HTTP ${response.status}`);
}
const canonical = await response.json();
if (JSON.stringify(local) !== JSON.stringify(canonical)) {
  throw new Error('Agent public pricing is out of sync with nexalayer-docs/public-pricing.json');
}
console.log('Agent public pricing matches the canonical public document');
