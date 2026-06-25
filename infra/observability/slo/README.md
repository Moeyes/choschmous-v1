# infra/observability/slo — SLOs, error budgets & burn-rate alerts (CHOS-504)

Service-level objectives for the MOEYS API and the Prometheus rules that enforce
them. Builds on the metrics stack in `../` (CHOS-105).

| File | Purpose |
| ---- | ------- |
| `slo.yaml` | Declarative SLO catalogue (source of truth, Sloth-compatible) |
| `slo-rules.yaml` | Prometheus recording rules + multi-window multi-burn-rate alerts (loaded by `../prometheus/prometheus.yml`) |

## Objectives

| SLO | Target (30d) | Error budget | SLI |
| --- | ------------ | ------------ | --- |
| Availability | 99.9% | 0.1% (~43m/30d) | non-5xx ÷ total responses |
| Latency | 99.0% < 750ms | 1.0% | requests faster than the 0.75s bucket ÷ total |

## Burn-rate alerting

Instead of a single static threshold, `slo-rules.yaml` uses **multi-window
multi-burn-rate** alerts (Google SRE workbook): an alert fires only when a long
window AND a short window both exceed the burn-rate threshold, so transient
spikes self-resolve but a real regression pages fast.

| Severity | Long / short window | Burn rate | Budget consumed | Routes to |
| -------- | ------------------- | --------- | --------------- | --------- |
| page (critical)  | 1h / 5m   | 14.4 | 2% in 1h  | PagerDuty |
| page (critical)  | 6h / 30m  | 6    | 5% in 6h  | PagerDuty |
| ticket (warning) | 1d / 2h   | 3    | 10% in 1d | default sink |
| ticket (warning) | 3d / 6h   | 1    | budget in 3d | default sink |

Severity labels are consumed by the existing Alertmanager routing
(`../alertmanager/alertmanager.yml`): `critical` → PagerDuty, `warning` → the
low-severity sink.

## Two enforcement points

The same SLOs gate the system at two layers:

1. **Deploy time** — `argocd/rollouts/analysis-templates.yaml` aborts a canary /
   blue-green promotion that would breach the SLO (automated rollback).
2. **Run time** — these burn-rate alerts page/ticket when live traffic erodes
   the budget.

The human side — what teams DO when the budget runs low — is
[`docs/ERROR_BUDGET_POLICY.md`](../../../docs/ERROR_BUDGET_POLICY.md).

## Keeping the two files in sync

`slo-rules.yaml` is hand-maintained while the build host is offline. Once the
`sloth` generator is available it can be regenerated from the catalogue:

```sh
sloth generate -i slo.yaml -o slo-rules.yaml
```

> TODO(infra): run that generation in CI to guarantee `slo.yaml ⇄ slo-rules.yaml`
> never drift, and add `postgres-/redis-exporter` SLOs once those targets exist.
