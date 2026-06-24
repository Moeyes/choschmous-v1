from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
import uuid
from datetime import datetime

from core.database import Base


class AuditLog(Base):
    """General-purpose audit trail (CHOS-305).

    One row per auditable action on official records (create/update/delete,
    review decisions, logins…). Distinct from PiiAccessLog, which is the
    narrower, legally-required trail of *PII reveals*. Like that table, the audit
    record outlives its actor/target (SET NULL) so history is never lost, and it
    NEVER stores the changed values themselves — only what happened, by whom.

    In a real deployment this table grows without bound, so the migration that
    introduces it leaves room to range-partition it by ``created_at`` later, the
    same way pii_access_logs is partitioned (CHOS-305).
    """

    __tablename__ = "audit_log"

    __table_args__ = (
        Index("ix_audit_log_entity", "entity_type", "entity_id"),
        CheckConstraint(
            "char_length(btrim(action)) > 0", name="ck_audit_log_action_nonempty"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Keep the audit record even if the actor user is later deleted.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # What happened, e.g. "create" / "update" / "delete" / "review" / "login".
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    # The kind of record acted on, e.g. "event" / "enrollment" / "organization".
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # The record's id as text (entities use int or uuid keys), nullable for
    # actions with no single target (e.g. a bulk operation or a login).
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Short, human-readable note — NEVER the changed PII values themselves.
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # CHOS-403: tamper-evident hash chain. Each row commits to the previous row's
    # ``row_hash`` (``prev_hash``) and to its own canonical content
    # (``row_hash = sha256(prev_hash || canonical(fields))``). Recomputing the
    # chain detects any after-the-fact edit, deletion, reorder, or insertion (see
    # app/application/audit/chain.py + writer.py). Written by AuditLogWriter only;
    # an append-only DB trigger (CHOS-403 migration) blocks UPDATE/DELETE as
    # defence in depth.
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    row_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
