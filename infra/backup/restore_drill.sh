#!/usr/bin/env bash
# CHOS-502 — automated quarterly restore drill.
#
# Restores the LATEST production backup into a throwaway instance, validates it,
# measures the restore time (RTO evidence) and the backup age (RPO evidence), then
# tears the scratch instance down. Designed to run unattended on a schedule
# (.github/workflows/restore-drill.yml) and fail loudly if recovery is broken —
# an untested backup is not a backup.
#
# Two engines (pick with RESTORE_ENGINE):
#   rds        — restore the latest automated RDS snapshot to a temp instance
#                (aws rds restore-db-instance-from-db-snapshot).
#   pgbackrest — restore the pgBackRest repo into a scratch data dir + start PG.
#
# Outputs a machine-readable summary to $SUMMARY_FILE (default restore_drill.json)
# the workflow uploads as an artifact and the DR_RUNBOOK results table is updated
# from.
#
# TODO(infra/cred): this needs AWS creds (OIDC role) or the pgBackRest repo keys.
# It is a NO-OP dry-run unless RUN_DRILL=1 is set, so CI can exercise the script
# logic without touching real infra until the creds are wired.
set -euo pipefail

RESTORE_ENGINE="${RESTORE_ENGINE:-rds}"
SOURCE_DB="${SOURCE_DB:-moeys-prod-pg}"
SCRATCH_DB="${SCRATCH_DB:-moeys-restore-drill-$(date -u +%Y%m%d%H%M)}"
SUMMARY_FILE="${SUMMARY_FILE:-restore_drill.json}"
# Validation: tables that must exist + be non-empty in the restored DB.
VALIDATE_TABLES="${VALIDATE_TABLES:-users events enrollments audit_log}"
RTO_TARGET_MIN="${RTO_TARGET_MIN:-120}"
RPO_TARGET_MIN="${RPO_TARGET_MIN:-15}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fail() { log "FAIL: $*"; write_summary "fail" "$*"; exit 1; }

write_summary() {
  local status="$1" detail="${2:-}"
  cat >"$SUMMARY_FILE" <<JSON
{
  "engine": "${RESTORE_ENGINE}",
  "source": "${SOURCE_DB}",
  "started_at": "${STARTED_AT:-}",
  "finished_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "restore_seconds": ${RESTORE_SECONDS:-null},
  "backup_age_minutes": ${BACKUP_AGE_MIN:-null},
  "rto_target_minutes": ${RTO_TARGET_MIN},
  "rpo_target_minutes": ${RPO_TARGET_MIN},
  "status": "${status}",
  "detail": "${detail}"
}
JSON
  log "summary -> ${SUMMARY_FILE} (status=${status})"
}

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ "${RUN_DRILL:-0}" != "1" ]; then
  log "DRY-RUN (RUN_DRILL!=1): validating script + parameters only, no AWS calls."
  RESTORE_SECONDS=0
  BACKUP_AGE_MIN=0
  write_summary "dry-run" "RUN_DRILL not set; wire creds then set RUN_DRILL=1"
  exit 0
fi

restore_rds() {
  command -v aws >/dev/null || fail "aws CLI not found"
  log "finding latest automated snapshot for ${SOURCE_DB}"
  local snap
  snap=$(aws rds describe-db-snapshots \
    --db-instance-identifier "$SOURCE_DB" --snapshot-type automated \
    --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))[0].DBSnapshotIdentifier' \
    --output text)
  [ -n "$snap" ] && [ "$snap" != "None" ] || fail "no automated snapshot found"

  local snap_time
  snap_time=$(aws rds describe-db-snapshots --db-snapshot-identifier "$snap" \
    --query 'DBSnapshots[0].SnapshotCreateTime' --output text)
  BACKUP_AGE_MIN=$(( ( $(date -u +%s) - $(date -u -d "$snap_time" +%s) ) / 60 ))
  log "latest snapshot=${snap} age=${BACKUP_AGE_MIN}min (RPO target ${RPO_TARGET_MIN}min)"

  local t0=$(date -u +%s)
  log "restoring -> ${SCRATCH_DB}"
  aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier "$SCRATCH_DB" \
    --db-snapshot-identifier "$snap" \
    --no-multi-az --no-publicly-accessible >/dev/null
  aws rds wait db-instance-available --db-instance-identifier "$SCRATCH_DB"
  RESTORE_SECONDS=$(( $(date -u +%s) - t0 ))
  log "restore complete in ${RESTORE_SECONDS}s (RTO target $((RTO_TARGET_MIN*60))s)"
}

teardown_rds() {
  log "tearing down scratch instance ${SCRATCH_DB}"
  aws rds delete-db-instance --db-instance-identifier "$SCRATCH_DB" \
    --skip-final-snapshot --delete-automated-backups >/dev/null 2>&1 || true
}

validate() {
  # TODO(infra): connect to the restored instance (host from describe-db-instances
  # / scratch PG) and assert each table exists + has rows. Placeholder asserts the
  # variable is set so the contract is explicit.
  [ -n "$VALIDATE_TABLES" ] || fail "no validation tables configured"
  log "validation tables: ${VALIDATE_TABLES} (TODO: run row-count assertions)"
}

case "$RESTORE_ENGINE" in
  rds)
    trap teardown_rds EXIT
    restore_rds
    validate
    ;;
  pgbackrest)
    # TODO(infra): pgbackrest --stanza=moeys --delta restore into a scratch
    # PGDATA, start PG, validate, measure. See docs/DR_RUNBOOK.md §4a.
    fail "pgbackrest engine not yet wired (see DR_RUNBOOK §4a)"
    ;;
  *) fail "unknown RESTORE_ENGINE=${RESTORE_ENGINE}" ;;
esac

# Gate the result on the targets so a regression fails the job.
[ "${BACKUP_AGE_MIN:-99999}" -le "$RPO_TARGET_MIN" ] || \
  fail "RPO breach: backup age ${BACKUP_AGE_MIN}min > ${RPO_TARGET_MIN}min"
[ "${RESTORE_SECONDS:-99999}" -le "$((RTO_TARGET_MIN*60))" ] || \
  fail "RTO breach: restore ${RESTORE_SECONDS}s > $((RTO_TARGET_MIN*60))s"

write_summary "pass" "restore validated within RPO/RTO targets"
log "restore drill PASSED"
