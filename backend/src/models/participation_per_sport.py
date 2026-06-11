from sqlalchemy import Integer, String, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base


class participation_per_sport(Base):
    __tablename__ = "participation_per_sport"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    sports_Events_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sports_event_org.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    org_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    athlete_female_count: Mapped[int] = mapped_column(
        Integer, nullable=True, server_default="0"
    )
    leader_female_count: Mapped[int] = mapped_column(
        Integer, nullable=True, server_default="0"
    )
    athlete_male_count: Mapped[int] = mapped_column(
        Integer, nullable=True, server_default="0"
    )
    leader_male_count: Mapped[int] = mapped_column(
        Integer, nullable=True, server_default="0"
    )
    # Review FSM: DRAFT -> SUBMITTED -> APPROVED | REJECTED | FLAGGED | REVISION_REQUESTED
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="SUBMITTED"
    )
    review_note: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
