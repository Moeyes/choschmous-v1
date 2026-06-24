# Vault secrets management (CHOS-201)

The backend (`backend/core/config.py`) refuses to boot without
`JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`, and `REDIS_URL` injected from the
environment — there are **no in-source defaults** anymore. In production those
values (plus **dynamic, short-lived Postgres credentials**) come from
HashiCorp Vault. This directory is the scaffold for that wiring.

> ⚠️ **This is scaffolding, not a running deployment.** No real Vault address,
> token, AppRole, or secret value is committed. Every place a live value is
> required is marked `TODO(infra)`. Nothing here provisions live infrastructure.

## What's here

| Path | Purpose |
| ---- | ------- |
| `policies/moeys-backend.hcl` | Least-privilege Vault policy for the backend |
| `agent/vault-agent.hcl` | Vault Agent auto-auth (AppRole) + template config |
| `templates/backend.env.ctmpl` | Renders the env file the backend sources at boot |
| `config/01-kv-and-approle.sh` | Operator bootstrap: KV v2 + policy + AppRole |
| `config/02-database-secrets-engine.sh` | Operator bootstrap: dynamic Postgres creds |
| `k8s/secretproviderclass.yaml` | Vault CSI provider (static secrets → K8s Secret) |
| `k8s/agent-injector-annotations.yaml` | Pod annotations for dynamic DB creds (Helm) |

## Two delivery paths

**Docker Compose (single-host / staging):** a `vault-agent` sidecar (see
`../../docker-compose.vault.yml`) renders `templates/backend.env.ctmpl` to a
shared volume; the backend sources it before launching uvicorn.

**Kubernetes (CHOS-205 Helm charts):** static secrets via the **Vault CSI
provider** (`k8s/secretproviderclass.yaml`) and dynamic DB creds via the
**Vault Agent Injector** annotations (`k8s/agent-injector-annotations.yaml`),
which the `deploy/helm` chart templates wire onto the api/worker pods.

## Operator bootstrap (run once, against a real Vault)

These provision live infra, so they are **not** run by CI. An operator with an
admin token runs them against the real cluster:

```sh
export VAULT_ADDR=...     # TODO(infra): real Vault endpoint
export VAULT_TOKEN=...    # TODO(infra): admin token (or `vault login`)
./config/01-kv-and-approle.sh        # KV v2 + policy + AppRole, prints role_id
./config/02-database-secrets-engine.sh   # dynamic Postgres creds role
```

`01-kv-and-approle.sh` writes the **static** secrets to
`secret/moeys/backend` — supply real, strong values via the `JWT_*`/`REDIS_URL`
env vars it reads (never commit them). It prints the AppRole `role_id`; deliver
the `secret_id` to the Vault Agent out-of-band (response-wrapped token), never
in git.

## Required live values (TODO(infra) checklist)

- [ ] Real `VAULT_ADDR` in `agent/vault-agent.hcl`, `k8s/secretproviderclass.yaml`
- [ ] AppRole `role_id` + `secret_id` mounted to the agent (Docker) / k8s-auth
      role (Kubernetes) — **never committed**
- [ ] Postgres host + a dedicated Vault-admin DB role in
      `config/02-database-secrets-engine.sh` (host comes from the managed PG in
      `infra/terraform`, CHOS-205)
- [ ] Strong static secret values written to `secret/moeys/backend`
