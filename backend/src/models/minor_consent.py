"""Guardian-consent record for a minor's PII (CHOS-501).

One row per enrollment of an under-18 participant. The minor's own PII lives on
``enrollments``; this table records the lawful basis for processing a child's
data: WHO consented (guardian), their relationship to the minor, the policy/text
version they agreed to, and WHEN. Deleting the enrollment cascades the consent
record — it has no meaning without its subject.

Modelled here and enforced in the registration flow
(``app/application/participants/validation.validate_minor_consent``), gated by
``settings.MINOR_CONSENT_ENFORCED`` (see config + docs/DATA_GOVERNANCE.md).
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from app.infrastructure.db.encrypted_types import EncryptedString

if TYPE_CHECKING:
    from src.models.enroll import Enroll


class MinorConsent(Base):
    __tablename__ = "minor_consents"

    # One consent record per enrollment (the guardian consents once, at capture).
    __table_args__ = (
        CheckConstraint(
            "char_length(btrim(guardian_name)) > 0",
            name="ck_minor_consent_guardian_name_nonempty",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    enroll_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="The minor's enrollment this consent authorises",
    )

    guardian_name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="Full name of the consenting guardian"
    )

    guardian_relationship: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Guardian's relationship to the minor (e.g. parent, legal guardian)",
    )

    # Guardian phone is Restricted-PII → envelope-encrypted at rest, same as the
    # enrollment phone (CHOS-403). Nullable: name + relationship + recorded consent
    # is the minimum; a contact number is optional.
    guardian_phone: Mapped[str | None] = mapped_column(
        EncryptedString(255),
        nullable=True,
        comment="Guardian phone number (PII, encrypted at rest)",
    )

    # Which consent text/policy version the guardian agreed to — makes a later
    # policy change auditable (re-consent can be required per version).
    consent_version: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="Policy/text version the guardian agreed to",
    )

    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    enroll: Mapped["Enroll"] = relationship("Enroll", uselist=False)
