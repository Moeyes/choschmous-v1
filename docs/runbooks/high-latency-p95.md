# Runbook: `HighRequestLatencyP95`

**Severity:** warning (ticket) · **Source:** `infra/observability/prometheus/alerts.yml`

## What it means

p95 request latency > 1s for >10m. The service is up and returning 2xx, but
slowly. Warning-level — open a ticket, do not page (unless it escalates into a
latency burn alert; see `slo-latency-burn.md`).

## Impact

Degraded UX. Sustained, it burns the **latency** error budget (target: 99% of
requests < 750ms).

## Diagnose

1. **Where is the time going?** p95 by route:
   ```promql
   histogram_quantile(0.95,
     sum by (le, handler) (rate(http_request_duration_seconds_bucket{job="moeys-backend"}[5m])))
   ```
2. **Traces** — open Tempo for the slow route; look for slow DB spans / N+1
   queries / external calls.
3. **Common roots:** missing/!used index (check `db-migrations.md`), DB CPU/IO
   saturation, connection-pool queueing, a heavy report/export endpoint, cold
   cache, GC/CPU throttling (resource limits).

## Mitigate

- **Hot query missing an index?** Add one (CONCURRENTLY in prod —
  `db-migrations.md`).
- **DB saturated?** Check RDS metrics; scale read replicas / instance.
- **Pool queueing?** Increase PgBouncer pool / API replicas (HPA).
- **One slow endpoint (reports)?** Confirm it is enqueued to the worker, not run
  inline.

## Escalate

If p95 keeps climbing toward a budget-burn (latency burn alert fires), treat as
`slo-latency-burn.md`.

## Related

`slo-latency-burn.md` · `db-migrations.md` · `../ERROR_BUDGET_POLICY.md`
