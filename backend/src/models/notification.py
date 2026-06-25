from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
import uuid
from datetime import datetime

from core.database import Base


class Notification(Base):
    """In-app notification inbox (CHOS-406).

    One row per notification delivered to a user. The inbox is append-only from
    the app's point of view: rows are created when something happens that the
    recipient should know about (their registration was confirmed, a submission
    they own was approved/rejected, a bulk import finished…), and the only
    mutation is stamping ``read_at`` when the user opens it.

    Kept deliberately small and self-contained: the body is a short rendered
    string and an optional ``link`` the UI can route to. It is NOT an audit log
    (that is audit_log / pii_access_logs) and never stores PII beyond what the
    recipient is already authorized to see.
    """

    __tablename__ = "notifications"

    __table_args__ = (
        # The inbox query is always "this user's notifications, newest first",
        # often filtered to unread — this composite index serves both.
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", "read_at"),
        CheckConstraint(
            "char_length(btrim(title)) > 0", name="ck_notifications_title_nonempty"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Recipient. Deleted with the user (an orphan inbox row is meaningless).
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Machine-readable category, e.g. "registration_confirmation",
    # "review_outcome", "bulk_import". Lets the UI pick an icon/route.
    type: Mapped[str] = mapped_column(String(64), nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional in-app deep link (relative path), e.g. "/participation/123".
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # NULL = unread. Stamped when the user opens/acknowledges it.
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
