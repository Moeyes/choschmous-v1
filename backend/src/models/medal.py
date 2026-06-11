from sqlalchemy import Integer, String, Enum, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base

from src.models.enum.user import medal_typeEnum


class Medal(Base):
    __tablename__ = "medals"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    athlete_participation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("athlete_participation.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    medal_type: Mapped[medal_typeEnum] = mapped_column(
        Enum(medal_typeEnum, name="medal_type_enum"),
        nullable=False,
        server_default="none",
    )
    key_performance: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
