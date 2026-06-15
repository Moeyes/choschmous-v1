from sqlalchemy import Integer, String, Text, Boolean, ForeignKey, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from core.database import Base


class OpenSurveyField(Base):
    __tablename__ = "open_survey_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_kh: Mapped[str] = mapped_column(String(255), nullable=False)
    label_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    field_type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="text"
    )
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    event = relationship("Events", backref="open_survey_fields")


class OpenSurveyResponse(Base):
    __tablename__ = "open_survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("open_survey_fields.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True, onupdate=func.now())

    field = relationship("OpenSurveyField", backref="responses")
    organization = relationship("Organization", backref="open_survey_responses")
