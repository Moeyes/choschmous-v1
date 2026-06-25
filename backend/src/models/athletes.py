from sqlalchemy import Integer, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime


from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from src.models.athlete_participation import AthleteParticipation

if TYPE_CHECKING:
    from src.models.enroll import Enroll

from core.database import Base


class Athlete(Base):
    __tablename__ = "athletes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    enroll_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Which enrollment this athlete is associated with",
    )

    enroll: Mapped["Enroll"] = relationship("Enroll", back_populates="athlete")

    participations: Mapped[list["AthleteParticipation"]] = relationship(
        "AthleteParticipation", back_populates="athlete", cascade="all, delete-orphan"
    )
