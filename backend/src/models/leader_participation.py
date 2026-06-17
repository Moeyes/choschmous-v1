from sqlalchemy import Integer, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from core.database import Base
from typing import TYPE_CHECKING

from src.models.organization import Organization

if TYPE_CHECKING:
    from src.models.leader import leader
    from src.models.sport import Sport


class leader_participation(Base):
    __tablename__ = "leader_participation"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    leaders_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("leaders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    leader_obj: Mapped["leader"] = relationship(
        "leader", back_populates="participations"
    )
    sport: Mapped["Sport"] = relationship("Sport", foreign_keys=[sports_id])
    organization: Mapped["Organization"] = relationship(
        "Organization", foreign_keys=[organization_id]
    )
