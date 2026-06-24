from sqlalchemy import (
    CheckConstraint,
    Integer,
    String,
    Enum,
    DateTime,
    func,
    ForeignKey,
    Date,
    Computed,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date

from core.database import Base
from app.infrastructure.db.encrypted_types import EncryptedString

from src.models.athletes import athletes
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.leader import leader
from src.models.enum.user import IdDocumentType, genderEnum


class Enroll(Base):  # haven't add phone number yet (check later)
    __tablename__ = "enrollments"

    # CHOS-305 data-integrity CHECK constraints:
    #  * ck_enroll_dob_range  — date_of_birth within a sane window (immutable
    #    bounds; an upper bound vs now() isn't allowed in a CHECK).
    #  * ck_enroll_phone_nonempty — phone is not blank/whitespace.
    #
    # NB: there is intentionally NO person-identity UNIQUE here. `enrollments` is
    # a per-REGISTRATION snapshot (a new row per registration), not a deduplicated
    # person master, and the app deliberately allows the same person across events
    # (and an explicit per-event `force` override). The enrollment "natural key"
    # that IS unique lives on athlete_participation (uq_athlete_participation_*):
    # the same athlete record may not be linked twice to one event/sport/category.
    __table_args__ = (
        CheckConstraint(
            "date_of_birth >= DATE '1900-01-01' AND date_of_birth <= DATE '2100-01-01'",
            name="ck_enroll_dob_range",
        ),
        CheckConstraint(
            "char_length(btrim(phonenumber)) > 0",
            name="ck_enroll_phone_nonempty",
        ),
    )

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

    # CHOS-403: phone is Restricted-PII, envelope-encrypted at rest. The column
    # is widened to hold the (larger) ciphertext; the ORM still reads/writes
    # plaintext transparently, so masking + the audited reveal endpoint are
    # unchanged. The ck_enroll_phone_nonempty CHECK still holds (ciphertext is
    # non-empty). NB: phone was removed from the search_text index below — PII
    # must not sit in a plaintext, searchable column.
    phonenumber: Mapped[str] = mapped_column(
        EncryptedString(255), nullable=False, comment="Phone number (PII, encrypted at rest)"
    )

    # CHOS-403: national-id NUMBER (distinct from national_id_path, the document
    # scan). Restricted-PII, envelope-encrypted at rest, nullable until captured.
    national_id: Mapped[str | None] = mapped_column(
        EncryptedString(255),
        nullable=True,
        comment="National ID number (PII, encrypted at rest)",
    )

    search_text: Mapped[str | None] = mapped_column(
        String(605),
        Computed(
            # Names only — phone (now encrypted/PII) is deliberately NOT indexed.
            "COALESCE(kh_family_name, '') || ' ' || COALESCE(kh_given_name, '') || ' ' || "
            "COALESCE(en_family_name, '') || ' ' || COALESCE(en_given_name, '')"
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
