# infra/backup — Database backups & disaster recovery (CHOS-103)

**Scaffold** for PostgreSQL backups via [pgBackRest](https://pgbackrest.org/)
with encrypted S3 storage and point-in-time recovery (PITR).

| File | Purpose |
| ---- | ------- |
| `pgbackrest.conf` | pgBackRest stanza + S3 repo config (secrets injected via env) |
| `cronjob.yaml` | Kubernetes CronJobs: weekly full + daily differential backups |
| `docs/DR_RUNBOOK.md` | Disaster-recovery runbook (RPO/RTO, restore & PITR steps) |

## First-time setup (TODO)

1. Create the S3 bucket + IAM user; put the keys and the backup cipher
   passphrase in your secret manager. **Never commit them.**
2. Populate the `pgbackrest-secrets` Secret and the `pgbackrest-config`
   ConfigMap (see comments in `cronjob.yaml`).
3. Configure the database for WAL archiving:
   ```
   archive_mode = on
   archive_command = 'pgbackrest --stanza=moeys archive-push %p'
   ```
4. Initialise and verify the stanza:
   ```bash
   pgbackrest --stanza=moeys stanza-create
   pgbackrest --stanza=moeys check
   pgbackrest --stanza=moeys --type=full backup
   ```
5. Apply the schedule: `kubectl apply -f infra/backup/cronjob.yaml`.

## Restores

See `docs/DR_RUNBOOK.md` for full-cluster restore and PITR procedures. Run a
**test restore monthly** — an untested backup is not a backup.
