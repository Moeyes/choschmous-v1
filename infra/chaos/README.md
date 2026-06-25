# Chaos experiments (CHOS-502)

Fault-injection experiments that **validate** the multi-AZ / HA design rather than
assume it. Two tools, by blast radius:

| Fault | Tool | File |
| ----- | ---- | ---- |
| Kill API/worker pods | Chaos Mesh `PodChaos` | `pod-kill.yaml` |
| Kill in-cluster Redis (dev/staging) | Chaos Mesh `PodChaos` | `redis-kill.yaml` |
| Partition the managed broker endpoint | Chaos Mesh `NetworkChaos` | `redis-kill.yaml` |
| **Lose a whole AZ** (nodes) | AWS FIS | `fis-az-failure.json` |
| **Force RDS / ElastiCache failover** | AWS FIS | `fis-az-failure.json` |

> Chaos Mesh runs *inside* the cluster and can break pods/network, but it cannot
> stop a real AZ or fail over a managed RDS/ElastiCache instance — that is what
> AWS FIS does. Use both: Chaos Mesh for the app tier, FIS for the cloud tier.

## Steady-state hypothesis

Before, during, and after every experiment the system must hold:

1. `GET /health/ready` returns `200` (the app stays serving).
2. HTTP 5xx rate stays `< 1%` over any 1-minute window (the SLO error budget,
   `infra/observability/slo/`).
3. The arq queue keeps draining (no growing backlog) — broker faults only.

`run_experiment.sh` polls (1) continuously and **aborts the experiment** if it
breaks for longer than the grace window — chaos must never *cause* the outage it
is testing resilience against.

## Running (non-prod first, always)

```bash
# Pod kill, watching readiness throughout:
infra/chaos/run_experiment.sh pod-kill.yaml https://staging.moeys.gov.kh

# AWS AZ failure (requires FIS role + experiment template id):
aws fis create-experiment-template --cli-input-json file://infra/chaos/fis-az-failure.json
aws fis start-experiment --experiment-template-id <id>
```

## Expected outcome (what "pass" means)

- **pod-kill**: a replacement pod is scheduled (likely in another AZ); readiness
  never drops below the PodDisruptionBudget minimum; no sustained 5xx.
- **redis-kill / partition**: cache misses fall through to Postgres (degraded, not
  down); the broker promotes its replica (prod Multi-AZ) and the queue resumes.
- **AZ failure**: pods reschedule onto the surviving AZs (topology-spread + PDB);
  RDS Multi-AZ promotes the standby; RTO within the DR target (`docs/DR_RUNBOOK.md`).

## Schedule

- App-tier (Chaos Mesh) experiments run on **staging weekly** via the chaos
  GitOps app (`argocd/` — CHOS-504) using `Schedule` resources (`schedule.yaml`).
- Cloud-tier (FIS) AZ/failover game-days run **quarterly**, paired with the
  restore drill (`infra/backup/restore_drill.sh`) — see `docs/DR_RUNBOOK.md §3`.

## Prerequisites (TODO+cred — no live infra here)

- `TODO(infra)`: install Chaos Mesh in the cluster (`chaos-mesh` namespace) via
  the GitOps app; restrict its RBAC to the `moeys` + `staging` namespaces only.
- `TODO(infra)`: create the AWS FIS IAM role (`fis-az-failure.json` references
  `arn:aws:iam::ACCOUNT_ID:role/moeys-fis`) with permissions scoped to
  `ec2:StopInstances`/`rds:RebootDBInstance` on tagged resources, and a CloudWatch
  stop-condition alarm so FIS auto-halts on a real SLO breach.
