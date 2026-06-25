from sqlalchemy import Enum, Integer, String, UniqueConstraint, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base
from src.models.enum.user import genderEnum


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    sports_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sports.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    gender: Mapped[genderEnum] = mapped_column(Enum(genderEnum), nullable=True)

    # Team sizing: max > 1 marks this as a team category (e.g. Doubles = 2).
    # Both nullable; an absent/None max means an individual category.
    team_size_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team_size_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    events_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    __table_args__ = (
        UniqueConstraint(
            "events_id", "sports_id", "category", name="uix_event_sport_category"
        ),
    )
