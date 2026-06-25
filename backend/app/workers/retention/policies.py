"""Per-data-class retention policies (CHOS-501).

Declarative-only: the retention schedule lives here so it can be reviewed in one
place and asserted by tests. The purge worker (:mod:`.purge`) iterates these.

Data classes mirror the governance taxonomy used by the ABAC engine
(``app.domain.policies.attributes.DataClass``). Each policy names ONE concrete
table, the timestamp column the window is measured from, the retention window (in
days, sourced from settings so ops can tune per environment), and the action:

* ``PURGE``       — rows older than the window are DELETE-able (when
  ``RETENTION_ENABLED``). Used for operational + access-log tables.
* ``ARCHIVE_ONLY`` — rows are retained at least this long but are **never deleted
  by this worker**. Used for the hash-chained ``audit_log``: deleting a chain row
  would break tamper-evidence (``AuditLogWriter.verify_chain``), so its long-term
  disposal is a deliberate, out-of-band archival step, not an automated purge.

NB: the data SUBJECT's own PII (``enrollments``) is intentionally NOT on a blanket
time-based purge here — official participation records must remain for legitimate
aggregate/statistical use. Removing an individual's personal data is the job of
the audited subject-erasure workflow (:mod:`.erasure`), not this scheduler.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.domain.policies.attributes import DataClass
from core.config import settings


class RetentionAction(str, Enum):
    PURGE = "purge"
    ARCHIVE_ONLY = "archive_only"


@dataclass(frozen=True)
class RetentionPolicy:
    """One retention rule for one table."""

    name: str
    data_class: DataClass
    table: str
    timestamp_column: str
    retention_days: int
    action: RetentionAction
    # Optional extra SQL predicate AND-ed with the age cutoff, e.g. only purge
    # already-revoked tokens or already-read notifications. Trusted, static SQL
    # (never built from request input) — there is no user data in these strings.
    extra_where: str | None = None
    description: str = ""

    @property
    def purgeable(self) -> bool:
        return self.action is RetentionAction.PURGE and self.retention_days > 0


def build_policies() -> list[RetentionPolicy]:
    """Construct the policy list from current settings (called at worker start so
    env overrides are honoured; tests call it directly)."""
    return [
        RetentionPolicy(
            name="pii_access_logs",
            data_class=DataClass.RESTRICTED_PII,
            table="pii_access_logs",
            timestamp_column="created_at",
            retention_days=settings.RETENTION_RESTRICTED_PII_DAYS,
            action=RetentionAction.PURGE,
            description="Restricted-PII reveal access logs past the PII window.",
        ),
        RetentionPolicy(
            name="refresh_tokens",
            data_class=DataClass.INTERNAL,
            table="refresh_tokens",
            timestamp_column="created_at",
            retention_days=settings.RETENTION_INTERNAL_DAYS,
            action=RetentionAction.PURGE,
            # Only purge tokens that are no longer usable (expired or revoked).
            extra_where="(revoked IS TRUE OR expires_at < now())",
            description="Spent (revoked/expired) refresh tokens.",
        ),
        RetentionPolicy(
            name="notifications",
            data_class=DataClass.INTERNAL,
            table="notifications",
            timestamp_column="created_at",
            retention_days=settings.RETENTION_INTERNAL_DAYS,
            action=RetentionAction.PURGE,
            # Only delete notifications the user has already read.
            extra_where="read_at IS NOT NULL",
            description="Read in-app notifications past the operational window.",
        ),
        RetentionPolicy(
            name="audit_log",
            data_class=DataClass.CONFIDENTIAL,
            table="audit_log",
            timestamp_column="created_at",
            retention_days=settings.RETENTION_AUDIT_LOG_DAYS,
            action=RetentionAction.ARCHIVE_ONLY,
            description=(
                "Hash-chained audit log — retained >=10y, never auto-deleted "
                "(deleting a chain row breaks tamper-evidence)."
            ),
        ),
    ]


# Convenience module-level snapshot (worker rebuilds via build_policies()).
POLICIES = build_policies()
