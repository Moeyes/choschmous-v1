# Runbook: `HighHttp5xxRate`

**Severity:** critical (pages) · **Source:** `infra/observability/prometheus/alerts.yml`

## What it means

>5% of API requests returned 5xx over the last 5m. The service is up but
failing a significant share of requests.

## Impact

Users hit errors registering / loading data. Directly burns the availability
error budget (see `slo-availability-burn.md`).

## Diagnose

1. **Which endpoints / which error?** Break down by route and status:
   ```promql
   topk(10, sum by (handler, status) (rate(http_requests_total{job="moeys-backend",status=~"5.."}[5m])))
   ```
2. **Correlate with traces/logs** — open Tempo for the failing route; structured
   logs carry `error_id` + `trace_id` (CHOS-204). Search Loki for the `error_id`.
3. **Common roots:**
   - DB: connection pool exhausted / Postgres down / slow queries / failover.
   - Redis: down → idempotency/rate-limit middleware fails closed (503).
   - A bad deploy introducing a regression.
   - A dependency (OIDC IdP) timing out.

## Mitigate

- **Recent deploy?** Roll back (canary SLO analysis should auto-abort — confirm):
  `kubectl argo rollouts abort moeys-api -n moeys-prod`.
- **DB pool exhausted?** Check `pool_size`/`max_overflow` saturation and slow
  queries; kill long-running queries; scale DB connections (PgBouncer).
- **Redis down?** Restore Redis; until then expect fail-closed 503s on
  idempotent writes (by design, CHOS-302).
- **Single bad dependency?** Apply the relevant circuit-breaker / feature flag.

## Escalate

Page Platform on-call if 5xx stays >5% for >15m or the root cause is data-layer.
Apply the error-budget policy if budget drops below 10%.

## Related

`backend-down.md` · `slo-availability-burn.md` · `../ERROR_BUDGET_POLICY.md`
