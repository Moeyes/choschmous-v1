from sqlalchemy import String, Integer, UniqueConstraint, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base


class sports_event_org(Base):
    __tablename__ = "sports_event_org"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    events_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sports_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sports.id", ondelete="SET NULL"), nullable=True, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default='SUBMITTED')
    review_note: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    __table_args__ = (
        UniqueConstraint(
            "events_id", "sports_id", "organization_id", name="uix_event_sport_org"
        ),
    )
