# Disaster Recovery Runbook — moved

The authoritative DR runbook now lives at **[`docs/DR_RUNBOOK.md`](../../../docs/DR_RUNBOOK.md)**
(CHOS-502). It has the validated RPO/RTO targets, the multi-AZ topology, the
automated quarterly restore drill (`infra/backup/restore_drill.sh`), and the chaos
game-day plan (`infra/chaos/`).

This file is kept only as a pointer so links from the backup tooling don't break.
The backup *implementation* (pgBackRest config + CronJob) still lives in this
directory:

- `infra/backup/pgbackrest.conf` — pgBackRest stanza config.
- `infra/backup/cronjob.yaml` — scheduled full/differential backups.
- `infra/backup/restore_drill.sh` — automated restore-and-validate drill.
