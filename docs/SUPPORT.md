# NexaLayer Support for Agents

NexaLayer's customers are mostly AI agents, so every support interaction is a
typed JSON object an agent can branch on. People who fund accounts can reach a
human at **support@nexalayer.net** (primary) or Telegram **@LEWISMIN**
(secondary). Never send API keys, proxy passwords, or `full_url` to either.

## Self-serve procedure

```text
on error E:
  1. if E.retryable and E.retry_after: wait E.retry_after; retry once (same Idempotency-Key)
  2. if E.suggested_action not in {report_issue, check_status}: perform it; stop
  3. GET /v1/public/status -> if the affected component is not operational: wait_and_retry or pause; stop
  4. if E.known_issue_id or GET /v1/public/known-issues?error_code=E.code matches: run workaround.steps; stop
  5. GET E.doc_url -> follow agent_steps
  6. POST /v1/support/tickets with request_ids, error_codes, session_id, reproduction, client
  7. poll GET /v1/support/tickets/{id} no sooner than next_check_after_seconds
never: send API keys, proxy credentials, or full_url; never retry paid writes without the same Idempotency-Key
```

## Error envelope (error_schema_version 1)

Every REST error keeps `code`, `message`, and `details` and adds:
`status`, `category`, `retryable`, `retry_after`, `suggested_action`,
`side_effects` (`charged`, `order_created`, `session_state_changed`; each
`true`, `false`, or `"unknown"`), `doc_url`, `known_issue_id`, `request_id`,
`support`, and `error_schema_version`. Every response carries an
`X-Request-Id` header equal to `meta.request_id`; 429/502/503/504 errors with a
`retry_after` also send `Retry-After`.

## Public endpoints (no API key)

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/public/status` | Components (`api`, `sessions`, `billing`, `catalog`, `upstream_network`) with Statuspage statuses, active incidents, and 30-day incident history. |
| `GET /v1/public/known-issues` | Known issues with runnable `workaround.steps`. Filters: `status`, `error_code`, `component`, `since`, `id`. |
| `GET /v1/public/errors` | Error catalog and the self-serve procedure. |
| `GET /v1/public/errors/{code}` | One catalog entry (the target of `error.doc_url`). |
| `GET /v1/public/sla` | Early-access response **targets**, not guarantees. |
| `GET /v1/public/support/ticket-states` | Ticket state machine. |

## Tickets (X-API-Key)

`POST /v1/support/tickets`, `GET /v1/support/tickets`, and
`GET /v1/support/tickets/{ticket_id}` are scoped to the key's account.

- The server assigns severity; `severity_claimed` is only a hint.
- Recent failed request ids and error codes on the same account (last 24h) are
  attached automatically. Request ids or sessions from other accounts are
  dropped.
- Credentials, proxy URLs, and `full_url` are redacted before storage. A
  redaction escalates the ticket to S1 security, so the owner can rotate.
- `Idempotency-Key` (header) or `idempotency_key` (body) make retries safe.
  Repeated reports with the same fingerprint (account, category, error codes,
  session) within 24h are appended to the open ticket.
- Limits: 5 new tickets per hour and 20 per day per key.

States: `received → triaged → (needs_info | in_progress) → (awaiting_approval |
workaround_available) → resolved → closed`. `awaiting_approval` means the
ticket is waiting for an owner decision (refund, credit, or public action).

## Response targets (early access, not guarantees)

| Severity | Meaning | Target |
| --- | --- | --- |
| S1 | Outage or wrong billing (and security) | 4 hours |
| S2 | Broken, no workaround | 24 hours |
| S3 | Bug with a workaround | 3 business days |
| S4 | Question or feature request | Best effort |

## Billing during upstream outages

If the upstream is down when a session is terminated, billing stops at the
**first** terminate attempt (`billing_stopped_at`). The session is marked
terminated immediately, and NexaLayer retries the upstream release in the
background with exponential backoff (1 minute up to 6 hours, 12 attempts). If
it still fails, the owner is paged to release it manually.

## Component status

Components change automatically from health probes (two consecutive upstream
probe failures mark `upstream_network` `partial_outage`; five mark it
`major_outage`) and from 5xx rates over 5 minutes (≥20% `degraded_performance`,
≥50% `partial_outage`, minimum 20 requests). The owner or product bot can also
set a component through the admin path:

```bash
curl -X POST "$API/v1/admin/status/components/sessions" \
  -H "Authorization: Bearer $OPS_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"degraded_performance","reason":"static pool errors"}'
```

An admin override sticks until an admin sets the component back to
`operational`, which hands it back to automatic checks. Every change records
incident history and sends an owner alert.

Tickets move through the state machine with
`POST /v1/admin/support/tickets/{ticket_id}/transition`
(`{"to":"in_progress","actor":"product_bot","reason":"assigned"}`).

## Owner alerts

`sendOpsAlert(event, severity, payload)` sends Telegram (and an optional
webhook) alerts, deduplicated to one alert per event and key per window
(`OPS_ALERT_DEDUPE_MINUTES`, default 30). Payloads are redacted. Events:

- `SUPPORT_TICKET_URGENT`: an S1 or S2 ticket was created.
- `COMPONENT_STATUS_CHANGED`: any component status change.
- `UPSTREAM_TERMINATE_FAILED` / `UPSTREAM_CLEANUP_GAVE_UP`: upstream release failed with billing stopped.
- `DEBIT_PROVISION_MISMATCH`: a session was provisioned without a debit record, or charged but not provisioned and the automatic refund failed.
- `TRIAL_CLAIM_SURGE`: trial claims exceeded the threshold (existing alert).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `OPS_ALERT_TELEGRAM_BOT_TOKEN` | Recommended | Falls back to `TRIAL_ALERT_TELEGRAM_BOT_TOKEN`. |
| `OPS_ALERT_TELEGRAM_CHAT_ID` | Recommended | Falls back to `TRIAL_ALERT_TELEGRAM_CHAT_ID`. |
| `OPS_ALERT_WEBHOOK_URL` | Optional | Falls back to `TRIAL_ALERT_WEBHOOK_URL`. |
| `OPS_ALERT_DEDUPE_MINUTES` | Optional | Default 30. |
| `OPS_ADMIN_TOKEN` | For the admin path | At least 32 characters. Admin routes return 404 when unset. |
| `SUPPORT_EMAIL` | Optional | Default `support@nexalayer.net`. |
| `SUPPORT_TELEGRAM` | Optional | Default `@LEWISMIN`. |
| `PUBLIC_API_BASE_URL` | Optional | Default `https://api.nexalayer.net`; used in `doc_url` and links. |
| `STATUS_CHECK_INTERVAL_SECONDS` | Optional | Default 60. |
| `UPSTREAM_CLEANUP_INTERVAL_SECONDS` | Optional | Default 60. |

## llms.txt section (for nexalayer.net/llms.txt)

```markdown
## Support (machine-readable)

- [Service status](https://api.nexalayer.net/v1/public/status): components, active incidents, incident history (JSON, no key)
- [Known issues](https://api.nexalayer.net/v1/public/known-issues): runnable workaround steps, filter by error_code
- [Error catalog](https://api.nexalayer.net/v1/public/errors): retryable, suggested_action, side_effects per code
- [Support response targets](https://api.nexalayer.net/v1/public/sla): early-access targets, not guarantees
- [File a ticket](https://docs.nexalayer.net/api-reference/openapi.json): POST /v1/support/tickets (X-API-Key), or MCP nexalayer_report_issue
- Human contact: support@nexalayer.net (Telegram @LEWISMIN). Never send API keys, proxy passwords, or full_url.
```
