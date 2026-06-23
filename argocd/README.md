# Argo CD GitOps (CHOS-205)

Declarative continuous delivery for the MOEYS platform. Argo CD reconciles the
cluster to the Helm charts in `../deploy/helm`.

| File | Purpose |
| ---- | ------- |
| `appproject.yaml` | `AppProject` scoping repos + the `moeys-{env}` destination namespaces |
| `applicationset.yaml` | One `ApplicationSet` → an `Application` per (api/bff/workers × dev/uat/staging/prod) |

## Model

The `ApplicationSet` matrix produces 12 `Application`s named
`moeys-<component>-<env>`, each pointing at `deploy/helm/<component>` with value
files `values.yaml` + `values-<env>.yaml`, deployed into `moeys-<env>`.

- **dev / uat** — `automated` sync (prune + selfHeal): merges roll out on their own.
- **staging / prod** — no `automated` block: changes are staged but require a
  reviewed, manual sync (appropriate for a government production system).

## Apply (manual, against a running Argo CD)

```sh
kubectl apply -f argocd/appproject.yaml
kubectl apply -f argocd/applicationset.yaml
```

> No cluster was available when this was authored, so these manifests have not
> been applied or validated against a live Argo CD. Fill in the `TODO(infra)`
> repo URL first.

## Placeholders to fill (`TODO(infra)`)

- `spec.sourceRepos` (AppProject) and `source.repoURL` (ApplicationSet) → real repo
- `source.targetRevision` → the branch/tag this environment tracks
