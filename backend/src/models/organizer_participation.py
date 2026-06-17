from typing import TYPE_CHECKING

from sqlalchemy import Integer, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database import Base

if TYPE_CHECKING:
    from src.models.enroll import Enroll


class OrganizerParticipation(Base):
    __tablename__ = "organizer_participation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    enroll_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    organizer_role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("organizer_roles.id", ondelete="RESTRICT"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    enroll: Mapped["Enroll"] = relationship("Enroll")
