# Disaster Recovery Runbook (CHOS-103) — SKELETON

> Status: **scaffold**. Fill in the TODOs and validate every procedure with a
> real test restore before relying on this document in an incident.

## 1. Objectives

| Metric | Target | Notes |
| ------ | ------ | ----- |
| RPO (max data loss) | **≤ 15 min** | bounded by WAL archive interval — TODO confirm |
| RTO (max downtime)  | **≤ 2 h**   | full-cluster restore from S3 — TODO measure |

## 2. Backup architecture

- **Tooling:** pgBackRest (`infra/backup/pgbackrest.conf`).
- **Schedule:** weekly full + daily differential (`infra/backup/cronjob.yaml`),
  plus continuous WAL archiving for point-in-time recovery (PITR).
- **Repository:** encrypted (AES-256) backups in S3.
  *TODO(CHOS-103): record bucket, region, and the secret-manager path for the
  S3 keys + cipher passphrase.*
- **Retention:** 7 full / 14 differential (tune to compliance requirements).

## 3. Routine verification

- [ ] `pgbackrest --stanza=moeys check` runs green after each backup (alert on fail).
- [ ] **Monthly test restore** into a throwaway environment; record elapsed time.
- [ ] Confirm WAL archiving is not falling behind (`pg_stat_archiver`).

## 4. Restore procedures

### 4a. Full cluster restore (latest)
```bash
# 1. Stop the database / scale the deployment to 0.
# 2. Restore the latest backup over an empty data directory:
pgbackrest --stanza=moeys --delta restore
# 3. Start PostgreSQL; it replays WAL to the end of the last backup.
# 4. Verify: row counts on key tables, app health endpoint /health/ready.
```

### 4b. Point-in-time recovery (PITR)
```bash
# Restore to a specific timestamp (e.g. just before a bad migration/delete):
pgbackrest --stanza=moeys --delta \
  --type=time --target="2026-06-23 09:30:00+07" restore
# Start PostgreSQL; promote once recovery target is reached.
```
*TODO(CHOS-103): document the exact promote/`recovery_target_action` steps for
this PostgreSQL version + deployment (k8s StatefulSet vs docker compose).*

## 5. Failover / rebuild checklist

1. Declare incident; notify stakeholders (see §6).
2. Provision a clean PostgreSQL instance with the same major version.
3. Restore (§4a or §4b).
4. Run `alembic current` / `alembic upgrade head` to confirm schema head.
5. Point the backend at the restored DB; run smoke tests.
6. Re-enable backups and confirm the next scheduled job succeeds.

## 6. Contacts & escalation

*TODO(CHOS-103): on-call rotation, DBA contact, cloud account owner, and the
PagerDuty/Alertmanager escalation policy (see infra/observability/).*

## 7. Open TODOs

- [ ] Wire S3 bucket + IAM credentials and the backup cipher passphrase.
- [ ] Run the one-time `stanza-create` and the first full backup.
- [ ] Measure and record actual RPO/RTO from a real test restore.
- [ ] Add backup-failure + WAL-lag alerts in infra/observability/.
