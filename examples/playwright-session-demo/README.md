# Playwright Session Demo

```bash
npm install
export NEXALAYER_API_KEY=agk_your_key
node index.mjs
```

The script creates a dynamic session, waits for `active`, launches Chromium with
`proxy.full_url`, visits `https://httpbin.org/ip`, and reports telemetry back to
NexaLayer. It also terminates the session in cleanup.

Set `NEXALAYER_PRODUCT_NO` only when you want to force a specific dynamic
product. Otherwise the script lists `/products?type=dynamic` and picks one
available product automatically.

Chinese guide: `../playwright-zh/README.md`
