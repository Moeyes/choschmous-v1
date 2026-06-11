from sqlalchemy import Integer, String, Enum, DateTime, func, ForeignKey, Date, Computed
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from core.database import Base

from src.models.athletes import athletes
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.leader import leader
from src.models.enum.user import IdDocumentType, genderEnum


class Enroll(Base):  # haven't add phone number yet (check later)
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    kh_family_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="នាមត្រកូល (ខ្មែរ)"
    )

    kh_given_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="នាមខ្លួន (ខ្មែរ)"
    )

    en_family_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Family name (Latin)"
    )

    en_given_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Given name (Latin)"
    )

    phonenumber: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Phone number"
    )

    search_text: Mapped[str | None] = mapped_column(
        String(605),
        Computed(
            "COALESCE(kh_family_name, '') || ' ' || COALESCE(kh_given_name, '') || ' ' || "
            "COALESCE(en_family_name, '') || ' ' || COALESCE(en_given_name, '') || ' ' || "
            "COALESCE(phonenumber, '')"
        ),
        nullable=True,
    )

    gender: Mapped[genderEnum] = mapped_column(Enum(genderEnum), nullable=False)

    nationality: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="Cambodian"
    )

    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    id_document_type: Mapped[IdDocumentType] = mapped_column(
        Enum(IdDocumentType), nullable=False
    )

    address: Mapped[str] = mapped_column(
        String(500), nullable=True, comment="Current residential address"
    )

    # ───────────────────────────────────────────────
    # Files / media
    # ───────────────────────────────────────────────
    photo_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Path to profile/student photo"
    )

    documents_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="JSON or comma-separated list of document paths, or folder path",
    )

    # New document path columns for multiple document uploads
    nationality_document_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Path to nationality document"
    )

    birth_certificate_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Path to birth certificate"
    )

    national_id_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Path to national ID document"
    )

    passport_path: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Path to passport document"
    )

    # ───────────────────────────────────────────────
    # Audit / relation
    # ───────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Which staff/admin created this enrollment",
    )

    athlete: Mapped["athletes"] = relationship(
        "athletes", back_populates="enroll", uselist=False
    )
    leader: Mapped["leader"] = relationship(
        "leader", back_populates="enroll", uselist=False
    )
