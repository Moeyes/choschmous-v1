from sqlalchemy import Integer, func, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.athletes import athletes
    from src.models.team import team
from src.models.sport import Sport
from src.models.category import category
from src.models.organization import Organization


class athlete_participation(Base):
    __tablename__ = "athlete_participation"

    # CHOS-305: the enrollment "natural key" that is genuinely unique. The same
    # athlete record must not be linked twice into the same event/sport/category
    # (the accidental double-submit that cleanup_duplicate_enrollments.sql cleans
    # up). The per-event `force` override still works: it creates a NEW athlete
    # row, so its athletes_id differs and this constraint is not violated.
    # (NULL category_id rows are treated as distinct by Postgres, as intended.)
    __table_args__ = (
        UniqueConstraint(
            "athletes_id",
            "events_id",
            "sports_id",
            "category_id",
            name="uq_athlete_participation_natural_key",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    athletes_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("athletes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    events_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True
    )

    sports_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sports.id", ondelete="SET NULL"), nullable=True
    )

    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )

    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )

    team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    athlete: Mapped["athletes"] = relationship(
        "athletes", back_populates="participations"
    )

    sport: Mapped["Sport"] = relationship("Sport")

    category: Mapped["category"] = relationship("category")

    organization: Mapped["Organization"] = relationship("Organization")

    team: Mapped["team | None"] = relationship("team", backref="members")
