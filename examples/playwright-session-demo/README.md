# Playwright Session Demo

```bash
npm install
export NEXALAYER_API_KEY=agk_your_key
export NEXALAYER_PRODUCT_NO=out_dynamic_1
node index.mjs
```

The script creates a dynamic session, waits for `active`, launches Chromium with
`proxy.full_url`, visits `https://httpbin.org/ip`, and reports telemetry back to
NexaLayer.
