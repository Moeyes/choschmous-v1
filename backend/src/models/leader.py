from sqlalchemy import Integer, Enum, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.enroll import Enroll
from src.models.enum.user import LeaderRole
from core.database import Base
from src.models.leader_participation import LeaderParticipation


class Leader(Base):
    __tablename__ = "leaders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    LeaderRole: Mapped[LeaderRole] = mapped_column(
        Enum(
            LeaderRole,
            name="leader_role",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        )
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    enroll_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Which enrollment this leader is associated with",
    )

    enroll: Mapped["Enroll"] = relationship("Enroll", back_populates="leader")
    participations: Mapped[list["LeaderParticipation"]] = relationship(
        "LeaderParticipation", back_populates="leader_obj"
    )
