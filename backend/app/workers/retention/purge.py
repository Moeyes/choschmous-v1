"""Scheduled per-data-class retention purge (CHOS-501).

Iterates the declared :data:`policies.POLICIES`, and for each *purgeable* policy
deletes rows older than its retention window. Two safety properties:

* **Dry-run by default.** Unless ``RETENTION_ENABLED`` (or an explicit
  ``enabled=True``) is set, nothing is deleted — the report still says how many
  rows WOULD be purged, so the schedule can be observed before it bites.
* **Audited.** Every purge line (even a dry-run) is written to the hash-chained
  audit log via :class:`AuditLogWriter`, recording the table, cutoff, and row
  count — never any row contents.

Table/column names come only from the static policy definitions (never request
input); the age cutoff is a bound parameter.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.audit.writer import AuditLogWriter
from app.workers.retention.policies import (
    RetentionPolicy,
    build_policies,
)
from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PurgeLine:
    policy: str
    table: str
    cutoff: datetime
    matched: int
    deleted: int
    action: str
    dry_run: bool


@dataclass
class PurgeReport:
    started_at: datetime
    finished_at: datetime | None = None
    dry_run: bool = True
    lines: list[PurgeLine] = field(default_factory=list)

    @property
    def total_matched(self) -> int:
        return sum(line.matched for line in self.lines)

    @property
    def total_deleted(self) -> int:
        return sum(line.deleted for line in self.lines)

    def as_dict(self) -> dict:
        return {
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "dry_run": self.dry_run,
            "total_matched": self.total_matched,
            "total_deleted": self.total_deleted,
            "lines": [
                {
                    "policy": line.policy,
                    "table": line.table,
                    "cutoff": line.cutoff.isoformat(),
                    "matched": line.matched,
                    "deleted": line.deleted,
                    "action": line.action,
                    "dry_run": line.dry_run,
                }
                for line in self.lines
            ],
        }


def _where_clause(policy: RetentionPolicy) -> str:
    # The cutoff is computed in SQL (``now() - interval``) rather than bound as a
    # Python datetime: the retention tables differ in timestamp tz-awareness
    # (``pii_access_logs`` is timestamptz, ``refresh_tokens`` is timestamp), and a
    # single bound Python datetime cannot satisfy both under asyncpg. Letting
    # Postgres derive the cutoff in each column's own type domain avoids that.
    clause = f"{policy.timestamp_column} < now() - make_interval(days => :days)"
    if policy.extra_where:
        clause = f"{clause} AND ({policy.extra_where})"
    return clause


async def run_retention_purge(
    db: AsyncSession,
    *,
    enabled: bool | None = None,
    now: datetime | None = None,
    policies: list[RetentionPolicy] | None = None,
    actor_role: str = "system:retention",
) -> PurgeReport:
    """Run the purge across all purgeable policies and return a report.

    ``enabled`` overrides ``settings.RETENTION_ENABLED`` (tests pass it
    explicitly); when falsy the run is a dry-run that counts but deletes nothing.
    ``now`` overrides the clock (tests). The caller owns commit/rollback.
    """
    if enabled is None:
        enabled = settings.RETENTION_ENABLED
    now = now or datetime.now(timezone.utc)
    policies = policies if policies is not None else build_policies()

    report = PurgeReport(started_at=now, dry_run=not enabled)
    writer = AuditLogWriter(db)

    for policy in policies:
        if not policy.purgeable:
            continue
        # cutoff is for the report/audit string only; the SQL filter uses the DB
        # clock via now() - interval (see _where_clause).
        cutoff = now - timedelta(days=policy.retention_days)
        where = _where_clause(policy)
        params = {"days": policy.retention_days}

        matched = (
            await db.execute(
                text(f"SELECT count(*) FROM {policy.table} WHERE {where}"), params
            )
        ).scalar() or 0

        deleted = 0
        if enabled and matched:
            result = await db.execute(
                text(f"DELETE FROM {policy.table} WHERE {where}"), params
            )
            deleted = result.rowcount or 0

        report.lines.append(
            PurgeLine(
                policy=policy.name,
                table=policy.table,
                cutoff=cutoff,
                matched=matched,
                deleted=deleted,
                action=policy.action.value,
                dry_run=not enabled,
            )
        )

        # Audit the purge decision (dry-run included). Row VALUES are never logged
        # — only the table, cutoff and counts.
        await writer.append(
            action="retention.purge" if enabled else "retention.purge.dryrun",
            entity_type=policy.table,
            actor_role=actor_role,
            summary=(
                f"data_class={policy.data_class.value} "
                f"window_days={policy.retention_days} cutoff={cutoff.isoformat()} "
                f"matched={matched} deleted={deleted}"
            ),
        )

    report.finished_at = now
    logger.info(
        "retention purge complete dry_run=%s matched=%s deleted=%s",
        report.dry_run,
        report.total_matched,
        report.total_deleted,
    )
    return report
