# Platform infrastructure (CHOS-205)

Terraform scaffold for the MOEYS platform: a Kubernetes cluster, managed
PostgreSQL, two managed Redis instances (application cache + arq job-queue
broker, CHOS-202), and the networking/security wiring between them.

> ⚠️ **Scaffold only.** `terraform apply` provisions live cloud infrastructure.
> Nothing here is applied by CI or by the change that introduced it. Every
> account-/network-/secret-specific value is a placeholder marked `TODO(infra)`.

## Layout

| File | Contents |
| ---- | -------- |
| `versions.tf` | Terraform + provider pins; remote-state backend (commented TODO) |
| `providers.tf` | AWS provider, default tags, `local.name` |
| `variables.tf` | All inputs (placeholder defaults / required vars) |
| `cluster.tf` | EKS cluster + managed node group |
| `database.tf` | RDS PostgreSQL (master secret via Secrets Manager, not git) |
| `redis.tf` | ElastiCache `cache` + `broker` replication groups |
| `outputs.tf` | Endpoints for Helm values + Vault DB secrets engine |
| `terraform.tfvars.example` | Copy → `<env>.tfvars`, fill in, never commit |

## Usage (manual)

```sh
cd infra/terraform
terraform init                                   # downloads pinned modules/providers
terraform validate
terraform plan  -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars             # MANUAL — never CI
```

> CLIs were unavailable in the environment that authored this, so
> `terraform validate` has **not** been run here — do so after filling in the
> TODO(infra) placeholders and running `terraform init`.

## How it connects to the rest

- `postgres_host` output → `infra/vault/config/02-database-secrets-engine.sh`
  (`PG_HOST`) so Vault can mint dynamic DB creds.
- `redis_cache_endpoint` / `redis_broker_endpoint` outputs → Helm values
  (`deploy/helm/*/values-<env>.yaml`) for the app `REDIS_URL` and the arq broker.
- `cluster_*` outputs → kubeconfig for Argo CD (`argocd/`) and Helm.
