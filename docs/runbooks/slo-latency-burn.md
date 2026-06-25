# Runbook: `MoeysAPILatencyBudgetBurn*`

**Severity:** critical (Fast → page) · warning (Medium → ticket)
**Source:** `infra/observability/slo/slo-rules.yaml`

## What it means

The API is burning its **latency error budget** (SLO: 99% of requests < 750ms /
30 days). The SLI "error" is a request slower than the 0.75s bucket.

| Alert | Burn | Meaning |
| ----- | ---- | ------- |
| `…BurnFast` | 14.4x | >14.4% of requests slower than 750ms over 1h — **page** |
| `…BurnMedium` | 6x | >6% over 6h — ticket |

## Impact

The service is up and returning 2xx, but slow enough that the latency budget is
draining. Sustained Fast burn is a UX incident.

## Diagnose

Same as [`high-latency-p95.md`](high-latency-p95.md): p95 by route, Tempo traces
for slow DB/external spans, check for missing indexes, DB saturation, pool
queueing, or a heavy inline endpoint.

## Mitigate

1. If a deploy regressed latency, abort/rollback the rollout (canary latency
   analysis should auto-abort — confirm).
2. Address the slow path: add the missing index (CONCURRENTLY in prod —
   [`db-migrations.md`](db-migrations.md)), scale the DB/replicas, or move heavy
   work to the worker queue.
3. Apply the error-budget policy if the budget drops below threshold.

## Escalate

Fast burn pages on-call. Coordinate with DBA if the root cause is the data
layer.

## Related

`high-latency-p95.md` · `db-migrations.md` · `../ERROR_BUDGET_POLICY.md` ·
`infra/observability/slo/README.md`
