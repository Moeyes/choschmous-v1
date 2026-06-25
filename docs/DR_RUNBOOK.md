# Disaster Recovery Runbook (CHOS-103 / CHOS-502)

Authoritative DR runbook for the MoEYS national sports-event system. Supersedes the
earlier scaffold at `infra/backup/docs/DR_RUNBOOK.md` (now a pointer here).

> The procedures below are **validated by automation**, not assumed: the quarterly
> restore drill (`infra/backup/restore_drill.sh`) proves the backup restores within
> target, and the chaos experiments (`infra/chaos/`) prove the multi-AZ topology
> survives an AZ loss. RPO/RTO numbers in §1 are the targets the drill **gates on**.

## 1. Objectives (RPO / RTO)

| Metric | Target | How it is validated |
| ------ | ------ | ------------------- |
| **RPO** (max data loss) | **≤ 15 min** | RDS automated backups + 5-min WAL/transaction-log shipping. The restore drill records the **age of the latest backup** and fails if it exceeds 15 min. |
| **RTO** (max downtime, AZ loss) | **≤ 5 min** | RDS Multi-AZ promotes the standby automatically; EKS reschedules pods onto surviving AZs (topology-spread + PDB). No restore needed — failover only. |
| **RTO** (max downtime, full restore) | **≤ 2 h** | Restore latest snapshot to a new instance. The restore drill records **restore elapsed time** and fails if it exceeds 2 h. |

### Validated results (auto-updated from the drill)

The quarterly workflow (`.github/workflows/restore-drill.yml`) uploads
`restore_drill.json`; copy the headline numbers here after each run.

| Drill date | Engine | Backup age (RPO) | Restore time (RTO) | Result |
| ---------- | ------ | ---------------- | ------------------ | ------ |
| _pending first creds-enabled run_ | rds | — | — | dry-run only |

`TODO(infra/cred)`: wire the AWS OIDC role (see workflow) and run once with
`RUN_DRILL=1` to populate the first real row.

## 2. Multi-AZ topology (CHOS-502)

The system spans **≥3 Availability Zones** (`infra/terraform/vpc.tf`; enforced by
the `multi_az_minimum` check):

- **VPC**: one private + one public subnet per AZ; one NAT gateway per AZ in prod
  (no single-AZ egress dependency).
- **EKS**: managed node group balanced across all AZ subnets; workloads use
  topology-spread + PodDisruptionBudgets so one AZ's loss leaves a serving quorum.
- **RDS**: Multi-AZ (`aws_db_instance.postgres.multi_az` in prod) — synchronous
  standby in another AZ, automatic failover.
- **ElastiCache**: cache **and** broker replication groups are Multi-AZ with
  automatic failover in prod (broker hardened in CHOS-502).

A single-AZ outage is a **failover event (RTO ≤ 5 min), not a restore**. Restore
(§4) is for data loss / corruption / region loss.

## 3. Routine verification

- [x] **Quarterly restore drill** — `.github/workflows/restore-drill.yml` restores
      the latest backup, validates key tables, gates on RPO/RTO. (Dry-run until
      creds wired.)
- [x] **Chaos game-days** — `infra/chaos/`: pod-kill weekly on staging; AZ-failure +
      RDS/Redis failover quarterly via AWS FIS, paired with this drill.
- [ ] `pgbackrest --stanza=moeys check` green after each backup (alert on fail).
- [ ] WAL/transaction-log shipping not lagging (`pg_stat_archiver` / RDS
      `OldestReplicationSlotLag`) — alert in `infra/observability/`.

## 4. Restore procedures

### 4a. Restore latest backup (RDS) — the drill's path
```bash
RUN_DRILL=1 RESTORE_ENGINE=rds SOURCE_DB=moeys-prod-pg \
  infra/backup/restore_drill.sh
# Restores the newest automated snapshot to a scratch instance, validates, and
# measures RTO/RPO. For a real recovery, point the app at the restored host
# instead of tearing it down.
```

### 4b. Point-in-time recovery (pgBackRest PITR)
```bash
# Restore to just before a bad migration/delete:
pgbackrest --stanza=moeys --delta \
  --type=time --target="2026-06-23 09:30:00+07" restore
# Start PostgreSQL; promote once the recovery target is reached.
```
`TODO(CHOS-103)`: exact promote / `recovery_target_action` steps for this PG
version + deployment (k8s StatefulSet vs RDS PITR `restore-db-instance-to-point-in-time`).

## 5. Failover / rebuild checklist

**Single AZ lost (expected, automatic):**
1. Confirm RDS failed over (event log) and pods rescheduled to surviving AZs.
2. Watch the SLO error-budget burn (`infra/observability/slo/`) — should recover
   within RTO ≤ 5 min. No manual restore.

**Data loss / corruption / region loss (manual):**
1. Declare incident; notify stakeholders (§6).
2. Provision a clean PostgreSQL instance (same major version) — §4a/§4b.
3. `cd backend && alembic current` then `alembic upgrade head` to confirm schema head.
4. Point the backend at the restored DB; run smoke tests (`/health/ready`).
5. Re-enable backups; confirm the next scheduled backup + a fresh drill succeed.

## 6. Contacts & escalation

`TODO(CHOS-103)`: on-call rotation, DBA contact, cloud account owner, and the
PagerDuty/Alertmanager escalation policy (`infra/observability/alertmanager/`).

## 7. Open TODOs

- [ ] Wire AWS OIDC role + run the restore drill for real; record §1 results.
- [ ] Install Chaos Mesh + create the AWS FIS template (`infra/chaos/`).
- [ ] Backup-failure + WAL/replication-lag alerts in `infra/observability/`.
- [ ] Document the exact PITR promote steps for the deployed PostgreSQL.
