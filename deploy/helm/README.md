# Helm charts (CHOS-205)

Three application charts for the MOEYS platform, deployed per environment
(`dev` / `uat` / `staging` / `prod`) and reconciled by Argo CD (`../../argocd`).

| Chart | What it runs | Service | Secrets |
| ----- | ------------ | ------- | ------- |
| `api/` | Backend FastAPI (`uvicorn`) | ClusterIP :8000 | Vault (CSI + Agent Injector) |
| `bff/` | Frontend / BFF (Next.js standalone) | ClusterIP :3003 | none (public client URL baked at build) |
| `workers/` | Background workers (`arq`) — report rendering (CHOS-202) | none | Vault (CSI + Agent Injector) |

Each chart has an **HPA** and **per-env `values-<env>.yaml`** overrides on top of
the chart `values.yaml`.

## Secrets wiring (CHOS-201)

`api` and `workers` consume Vault:

- **Static** secrets (`JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`, `REDIS_URL`)
  via the **Vault CSI provider** — synced into a K8s Secret and pulled in with
  `envFrom`. The pod mounts the CSI volume to trigger the sync.
- **Dynamic** Postgres credentials via the **Vault Agent Injector** — rendered to
  `/vault/secrets/db.env` and sourced by the container command before launch.

`config.py` requires all three static secrets at import, so `workers` carries
them too even though it never mints tokens.

## Usage (manual)

```sh
# Lint (CLIs were unavailable when this was authored — lint has NOT been run here)
helm lint deploy/helm/api -f deploy/helm/api/values-prod.yaml

# Render to inspect output
helm template moeys deploy/helm/api -f deploy/helm/api/values-dev.yaml

# Install/upgrade (normally Argo CD does this, not a human)
helm upgrade --install moeys-api deploy/helm/api \
  -n moeys-dev --create-namespace -f deploy/helm/api/values-dev.yaml
```

## Placeholders to fill (`TODO(infra)`)

- `image.repository` in each chart → real GHCR repo (`docker.yml` output)
- `config.DB_HOST` / `ARQ_REDIS_URL` per env → terraform outputs (CHOS-205)
- `vault.*.vaultAddress` / `vault.hashicorp.com/service` per env → real Vault
- `config.API_PROXY_TARGET` (bff) → must match the api Service name per namespace
