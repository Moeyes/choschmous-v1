# Runbooks (CHOS-506)

One runbook per alert (plus operational runbooks). When an alert fires, its
`runbook` annotation links here. Every page-severity alert in
`infra/observability/` must have a runbook.

## Per-alert

| Alert (Prometheus) | Runbook | Severity |
| ------------------ | ------- | -------- |
| `BackendDown` | [backend-down.md](backend-down.md) | critical |
| `HighHttp5xxRate` | [high-5xx-rate.md](high-5xx-rate.md) | critical |
| `HighRequestLatencyP95` | [high-latency-p95.md](high-latency-p95.md) | warning |
| `MoeysAPIAvailabilityBudgetBurn*` | [slo-availability-burn.md](slo-availability-burn.md) | critical / warning |
| `MoeysAPILatencyBudgetBurn*` | [slo-latency-burn.md](slo-latency-burn.md) | critical / warning |

## Operational

| Runbook | Purpose |
| ------- | ------- |
| [db-migrations.md](db-migrations.md) | Alembic workflow + production index creation |
| [`../DR_RUNBOOK.md`](../DR_RUNBOOK.md) | Disaster recovery / restore drill (CHOS-502) |

## Runbook structure

Each per-alert runbook follows: **What it means → Impact → Diagnose → Mitigate →
Escalate → Related**. Keep them terse and action-first; they are read at 3am.
