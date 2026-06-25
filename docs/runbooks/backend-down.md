# Runbook: `BackendDown`

**Severity:** critical (pages) · **Source:** `infra/observability/prometheus/alerts.yml`

## What it means

Prometheus cannot scrape `moeys-backend` (`up == 0`) for >2m. The API process is
unreachable from Prometheus — crashed, not scheduled, network-partitioned, or the
`/metrics` endpoint is down.

## Impact

Likely a full or partial API outage. Citizens/schools cannot register or log in.
This burns the availability error budget fast.

## Diagnose

1. Confirm scope — is it all replicas or one?
   ```bash
   kubectl get pods -n moeys-prod -l app.kubernetes.io/name=moeys-api
   kubectl get rollout moeys-api -n moeys-prod
   ```
2. Check pod events / logs for the unhealthy pods:
   ```bash
   kubectl describe pod <pod> -n moeys-prod
   kubectl logs <pod> -n moeys-prod --previous | tail -100
   ```
3. Probe health directly (port-forward): `GET /health` (liveness) and
   `/health/ready` (readiness — checks DB/Redis).
4. Check upstream deps: Postgres (RDS) and Redis reachable? DB connection pool
   exhausted? (see `high-5xx-rate.md` diagnosis).

## Mitigate

- **Recent deploy?** Abort/rollback the rollout (this should have happened
  automatically via SLO analysis — confirm):
  ```bash
  kubectl argo rollouts abort moeys-api -n moeys-prod
  kubectl argo rollouts undo moeys-api -n moeys-prod
  ```
- **CrashLoopBackOff?** Read logs; if config/secret-driven, fix the
  ConfigMap/Vault secret and restart.
- **Resource pressure / not scheduled?** Check node capacity & HPA; scale up.
- **Whole AZ down?** Follow [`../DR_RUNBOOK.md`](../DR_RUNBOOK.md) (multi-AZ
  failover, CHOS-502).

## Escalate

If not mitigated within 15m or root cause is the DB/infra, page the Platform
on-call lead and follow the error-budget policy
([`../ERROR_BUDGET_POLICY.md`](../ERROR_BUDGET_POLICY.md)).

## Related

`high-5xx-rate.md` · `slo-availability-burn.md` · `../DR_RUNBOOK.md`
