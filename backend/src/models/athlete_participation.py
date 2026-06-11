from sqlalchemy import Integer, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.athletes import athletes
from src.models.sport import Sport
from src.models.category import category
from src.models.organization import Organization


class athlete_participation(Base):
    __tablename__ = "athlete_participation"

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

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    athlete: Mapped["athletes"] = relationship(
        "athletes", back_populates="participations"
    )

    sport: Mapped["Sport"] = relationship("Sport")

    category: Mapped["category"] = relationship("category")

    organization: Mapped["Organization"] = relationship("Organization")
