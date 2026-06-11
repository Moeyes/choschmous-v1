import uuid
from sqlalchemy import Integer, String, Enum, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base
from src.models.enum.org import instituteType


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    name_kh: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[instituteType] = mapped_column(
        Enum(instituteType, name="institute_type"), nullable=False
    )
    code: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
