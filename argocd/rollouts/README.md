# Argo Rollouts — progressive delivery (CHOS-504)

Canary / blue-green deployment with **SLO-driven automated rollback** for the
MOEYS platform. Layered on top of the GitOps setup in `../` (CHOS-205): Argo CD
syncs these manifests; the [argo-rollouts] controller drives the actual
ReplicaSet progression.

[argo-rollouts]: https://argo-rollouts.readthedocs.io/

| File | Purpose |
| ---- | ------- |
| `analysis-templates.yaml` | `AnalysisTemplate`s querying Prometheus (success rate, p95 latency) — the auto-rollback trigger |
| `api-rollout.yaml` | API tier `Rollout` — **canary** (10→30→60→100%) |
| `bff-rollout.yaml` | BFF/frontend tier `Rollout` — **blue-green** |

## Why two strategies

- **API → canary.** Stateless, horizontally scaled, request-scoped. Shifting a
  small traffic slice first means a bad build only ever touches ~10% of users
  before analysis aborts it.
- **BFF → blue-green.** A Next.js server bundles UI + server routes as one
  version; splitting a session across versions risks hydration mismatches and
  stale-asset 404s. Blue-green promotes the new version atomically after it
  passes pre-promotion analysis, so no user is ever served a half-old bundle.

## Automated rollback on SLO breach

The two `AnalysisTemplate`s run the SLO queries from
`infra/observability/slo/` against Prometheus while the new version takes
traffic:

- **success-rate** must stay `>= 0.99` (availability SLO is 99.9%; one nine of
  canary headroom).
- **p95 latency** must stay `<= 1.0s` (latency SLO target is 750ms).

Each metric is sampled every 30s; `failureLimit: 3` consecutive bad reads fails
the `AnalysisRun`. A failed run makes Argo Rollouts **abort** — canary traffic
returns to the stable ReplicaSet; blue-green simply never cuts over. This is the
deploy-time half of the error-budget policy in
[`docs/ERROR_BUDGET_POLICY.md`](../../docs/ERROR_BUDGET_POLICY.md): a release that
would burn budget is reverted before it can.

## Apply (manual, against a running cluster)

```sh
kubectl apply -f argocd/rollouts/analysis-templates.yaml
kubectl apply -f argocd/rollouts/api-rollout.yaml
kubectl apply -f argocd/rollouts/bff-rollout.yaml
# Watch a rollout:
kubectl argo rollouts get rollout moeys-api -n moeys-prod --watch
# Manual abort (also triggered automatically on analysis failure):
kubectl argo rollouts abort moeys-api -n moeys-prod
```

> No cluster was available when this was authored — these manifests have **not**
> been applied or validated against a live argo-rollouts controller.

## `TODO(infra)` to fill before applying

- Install the `argo-rollouts` controller in the cluster.
- `analysis-templates.yaml` → real in-cluster Prometheus `address`.
- `api-rollout.yaml` → a traffic router (Gateway API / SMI / nginx) under
  `strategy.canary.trafficRouting` so weighted steps actually split traffic.
- `bff-rollout.yaml` → create the `moeys-bff` (active) + `moeys-bff-preview`
  Services.
- Real image `repository`/`tag` (matches `.github/workflows/docker.yml`).
- Migrate `deploy/helm/{api,bff}` from `kind: Deployment` to these `Rollout`s
  (keep the pod templates in sync — only `kind` + `strategy` should differ).
