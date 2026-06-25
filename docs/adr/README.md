# Architecture Decision Records (CHOS-506)

Numbered, immutable records of significant architectural decisions. See
[ADR-0001](0001-record-architecture-decisions.md) for why we keep this log and
[`template.md`](template.md) for the format. Supersede, don't edit.

## Log

| # | Decision | Status |
| - | -------- | ------ |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted |
| [0002](0002-alembic-single-source-of-truth.md) | Alembic is the single source of truth for schema | accepted |
| [0003](0003-pascalcase-orm-model-class-names.md) | PascalCase ORM model class names | accepted |

## Earlier decisions documented elsewhere

Several foundational decisions predate this log; their rationale lives with the
artifact they govern. Capture future changes to these as new ADRs:

| Decision | Where it is documented |
| -------- | ---------------------- |
| Deny-by-default ABAC authorization (CHOS-402) | `backend/app/domain/policies/` + `docs/THREAT_MODEL.md` §3.2 |
| Field-level PII encryption + hash-chained audit log (CHOS-403) | `docs/DATA_GOVERNANCE.md`, `docs/THREAT_MODEL.md` §3.3 |
| Multi-AZ topology + DR (CHOS-502) | `docs/DR_RUNBOOK.md`, `infra/terraform/` |
| Progressive delivery (canary/blue-green) + SLO auto-rollback (CHOS-504) | `argocd/rollouts/README.md`, `infra/observability/slo/` |
| Error-budget policy (CHOS-504) | `docs/ERROR_BUDGET_POLICY.md` |
| mTLS between tiers + cosign image signing (CHOS-505) | `infra/mesh/`, `infra/admission/`, `docs/THREAT_MODEL.md` §3.4–3.5 |

## Adding an ADR

1. Copy `template.md` to `NNNN-short-title.md` (next number).
2. Fill it in; set status `proposed`, open a PR.
3. On merge, set status `accepted` and add a row to the Log table above.
