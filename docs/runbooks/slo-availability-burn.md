# Runbook: `MoeysAPIAvailabilityBudgetBurn*`

**Severity:** critical (Fast/Medium → page) · warning (Slow/Trickle → ticket)
**Source:** `infra/observability/slo/slo-rules.yaml`

## What it means

The API is consuming its **availability error budget** (99.9% / 30 days) faster
than sustainable. Multi-window multi-burn-rate alerts (Google SRE workbook):

| Alert | Burn | Meaning |
| ----- | ---- | ------- |
| `…BurnFast` | 14.4x | 2% of the 30d budget in 1h — **page** |
| `…BurnMedium` | 6x | 5% in 6h — **page** |
| `…BurnSlow` | 3x | 10% in 1d — ticket |
| `…BurnTrickle` | 1x | will exhaust the budget in 30d — ticket |

## Impact

Users are getting errors. Fast/Medium will exhaust the budget within hours —
this is an active incident.

## Diagnose

This is "too many 5xx" measured against the budget — diagnose as
[`high-5xx-rate.md`](high-5xx-rate.md): break down 5xx by route, correlate with
Tempo/Loki via `error_id`, check DB/Redis/recent deploys.

## Mitigate

1. **Stop the bleeding.** If a deploy caused it, the canary SLO analysis should
   have auto-aborted — confirm, else `kubectl argo rollouts abort moeys-api -n moeys-prod`.
2. Fix the underlying 5xx cause (see `high-5xx-rate.md`).
3. **Apply the error-budget policy** ([`../ERROR_BUDGET_POLICY.md`](../ERROR_BUDGET_POLICY.md)):
   if remaining budget < 10%, declare a **feature freeze** — only reliability/
   security fixes ship until budget recovers above 25%.

## Escalate

Fast/Medium burn pages on-call immediately. If budget is exhausted, page the
Platform lead, open a blameless postmortem, and notify leadership.

## Related

`high-5xx-rate.md` · `backend-down.md` · `../ERROR_BUDGET_POLICY.md` ·
`infra/observability/slo/README.md`
