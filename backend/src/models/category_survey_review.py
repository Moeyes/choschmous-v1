from sqlalchemy import Integer, String, UniqueConstraint, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base


class CategorySurveyReview(Base):
    """Review-state header for a by-category submission.

    A by-category submission is the *set* of ``categories`` rows a federation
    declares for one ``(events_id, sports_id)`` pair. The categories themselves
    stay in the ``categories`` table (relationship intact); this row only carries
    the admin review FSM for that pair — mirroring ``participation_per_sport``'s
    status columns so by-category gets the same review treatment as by-number.

    One row per (event, sport); created on submit (``upsert_categories``).
    """

    __tablename__ = "category_survey_review"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    events_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sports_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sports.id", ondelete="SET NULL"), nullable=True, index=True
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
    __table_args__ = (
        UniqueConstraint(
            "events_id", "sports_id", name="uix_category_review_event_sport"
        ),
    )
