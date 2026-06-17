from sqlalchemy import Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from core.database import Base


class Sport(Base):
    __tablename__ = "sports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_kh: Mapped[str] = mapped_column(String(100), nullable=False)
    # Nullable here to allow adding the column without mutating existing rows; API should still supply a value.
    sport_type: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
