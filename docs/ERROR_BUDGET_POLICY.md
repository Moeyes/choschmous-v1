# Error-Budget Policy (CHOS-504)

> Status: **active policy**. Owner: Platform team. Review: quarterly.

This policy defines how the MOEYS platform trades off **velocity** (shipping
features) against **reliability** (keeping the service up for citizens and
schools). It turns the SLOs in
[`infra/observability/slo/`](../infra/observability/slo/README.md) into concrete
decisions about what the team is allowed to do.

## 1. The budget

| SLO | Target (rolling 30 days) | Error budget |
| --- | ------------------------ | ------------ |
| API availability | 99.9% successful responses | 0.1% (~43m13s of full outage equivalent) |
| API latency | 99.0% of requests < 750ms | 1.0% |

The **error budget** is the amount of unreliability we are willing to spend.
Spending it is normal and expected — a budget at 100% means we are being too
conservative and shipping too slowly.

## 2. Budget states & required actions

Burn is measured by the multi-window multi-burn-rate alerts in
`infra/observability/slo/slo-rules.yaml`.

| Remaining budget (30d) | State | Policy |
| ---------------------- | ----- | ------ |
| **> 50%** | Healthy | Normal feature velocity. Ship freely. |
| **10–50%** | Caution | Ship, but every change goes out via canary/blue-green (CHOS-504). No risky migrations on Fridays. |
| **< 10%** | **Budget freeze** | **Feature freeze.** Only reliability fixes, security patches, and rollbacks may ship until the budget recovers above 25%. A freeze is declared by the on-call lead and recorded in the incident channel. |
| **Exhausted (≤ 0%)** | Breach | As above + a mandatory blameless postmortem (`docs/runbooks/`) and an SLO review. Page leadership. |

## 3. Fast burn → page now

A **page-severity** burn-rate alert (14.4x or 6x — see the SLO README table)
means the budget will be gone in hours, not weeks. It pages on-call immediately
regardless of the remaining-budget state above. Follow the per-alert runbook
(`docs/runbooks/slo-availability-burn.md`, `slo-latency-burn.md`).

## 4. Automated enforcement at deploy time

The team does not have to remember the freeze for *deploys*: a release that
would breach the SLO is reverted automatically.

- Canary / blue-green rollouts run the SLO `AnalysisTemplate`s
  (`argocd/rollouts/`). A breach during rollout **aborts and rolls back** before
  the version reaches all users.
- This means most budget protection is mechanical; the human policy above
  governs *what new work is permitted*, not whether a single bad deploy ships.

## 5. Changing the SLO

If the budget is chronically exhausted through no fault of the team (e.g. the
target is unrealistic for the infrastructure), the fix is to **revise the SLO**,
not to ignore it. SLO changes require:

1. A PR editing `infra/observability/slo/slo.yaml` **and** regenerating
   `slo-rules.yaml`.
2. Sign-off from the Platform lead + the service owner.
3. An entry in `docs/adr/` recording the rationale.

## 6. Reporting

- Current budget burn is visible on the Grafana SLO dashboard (TODO(infra): add
  a dashboard JSON under `infra/observability/grafana/provisioning/dashboards`).
- The public-facing health summary is the status page
  (`infra/statuspage/`), which reflects availability but **not** the internal
  budget figures.
