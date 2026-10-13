# Launch +48 hour on-call runbook

This runbook starts when the GitHub Release, npm package, PyPI package, and MCP Registry entry are all public. Record named primary and backup owners in the launch ticket before release; do not launch with unassigned placeholders.

## Coverage and checks

The primary owner checks the dashboard at launch, +1h, +4h, +12h, +24h, and +48h. The backup acknowledges any page within 15 minutes if the primary does not.

Monitor:

- trial claims per hour, rejection reason, source, IP hash, and installation hash;
- `TRIAL_CLAIM_SURGE` webhook delivery and monitor errors;
- API-key request success, first Session success, and paid conversion;
- `npm view @nexalayer/mcp`, clean `npx` install, PyPI install, and MCP Registry install;
- canonical pricing versus `/v1/public/products`, `/agents`, and `llms.txt`;
- 5xx rate, p95 latency, backend reachability, wallet debit failures, and idempotency conflicts.

## Page and rollback thresholds

Page the primary and backup when any one condition is true:

- trial claims meet `TRIAL_ALERT_CLAIM_THRESHOLD` within `TRIAL_ALERT_WINDOW_MINUTES`;
- trial rejections or API-key delivery failures exceed 10% over 15 minutes;
- package installation or MCP initialization fails twice from a clean environment;
- any public price differs from the canonical price source;
- paid Session creation has two unexplained debit/provision mismatches;
- API 5xx exceeds 2% for 10 minutes or p95 latency exceeds 5 seconds for 15 minutes.

Disable automatic trial issuance (`TRIAL_BALANCE=0`) if abuse is causing material cost or eligibility controls fail closed incorrectly. Roll back the application deployment for a code regression. Deprecate rather than unpublish a package unless it contains a secret or creates immediate user harm.

## Patch target

Acknowledge pages within 15 minutes, decide mitigation within 30 minutes, and ship a tested patch release within 2 hours for a launch-blocking defect. Hotfixes use the same CI, dry-run, publication, `npm view`/PyPI visibility, clean-install, and smoke-test gates as the initial release.

For every incident, record timestamps, affected versions, metrics, decision owner, rollback or patch hash, and follow-up action in the launch ticket.
