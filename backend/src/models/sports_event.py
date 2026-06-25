from sqlalchemy import Enum, Integer, UniqueConstraint, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from core.database import Base
from src.models.enum.event import SportMode

# Shared enum type so the column maps to the existing `sport_mode` PG type.
_sport_mode_enum = Enum(
    SportMode,
    name="sport_mode",
    values_callable=lambda e: [m.value for m in e],
)


class SportsEvent(Base):
    __tablename__ = "sports_event"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    events_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sports_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sports.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # --- Per-sport competition config (Phase 2) ------------------------
    mode: Mapped[SportMode] = mapped_column(
        _sport_mode_enum, nullable=False, server_default=SportMode.INDIVIDUAL.value
    )
    team_size_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team_size_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_athletes_per_org: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_teams_per_org: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    __table_args__ = (
        UniqueConstraint("events_id", "sports_id", name="uix_event_sport"),
    )
