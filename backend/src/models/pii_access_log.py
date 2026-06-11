from sqlalchemy import Integer, String, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from core.database import Base


class PiiAccessLog(Base):
    """Audit trail for on-demand reveals of Restricted-PII (data-governance §4/§6).

    One row per reveal action. Records WHO accessed WHICH field(s) of WHICH
    participant and WHEN — but never the value itself, so the audit log does not
    become a second copy of the PII it is meant to govern.
    """

    __tablename__ = "pii_access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Nullable + SET NULL: keep the audit record even if the actor is deleted.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[str] = mapped_column(String(32), nullable=False)
    target_enroll_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # Comma-separated field names revealed (e.g. "phone"). Never the values.
    fields: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
