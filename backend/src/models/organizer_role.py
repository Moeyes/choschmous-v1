from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class OrganizerRole(Base):
    __tablename__ = "organizer_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_kh: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
