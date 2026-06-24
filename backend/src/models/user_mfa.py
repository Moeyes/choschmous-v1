from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
import uuid
from datetime import datetime

from core.database import Base
from app.infrastructure.db.encrypted_types import EncryptedString


class UserMfa(Base):
    """Per-user multi-factor-authentication enrolment (CHOS-401).

    One row per user who has started or completed MFA enrolment. Separate from
    ``users`` so the credential material lives in its own table (tighter access
    surface) and an un-enrolled user simply has no row.

    Security notes:
      * ``totp_secret`` is shared-secret key material, so it is envelope-encrypted
        at rest via the ``EncryptedString`` type (CHOS-403).
      * ``recovery_codes`` holds **hashes only** (see services/mfa/recovery.py) —
        never the plaintext codes.
      * ``webauthn_credentials`` holds public keys + signature counters only;
        WebAuthn never exposes a private key to the server by design.
    """

    __tablename__ = "user_mfa"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Pending until the user proves possession by entering a code; flipped to True
    # by activate(). A pending secret is set but totp_enabled stays False, so a
    # half-finished enrolment never gates login.
    totp_secret: Mapped[str | None] = mapped_column(
        EncryptedString(255), nullable=True
    )
    totp_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # List[str] of SHA-256 hashes of unused recovery codes. Consuming a code
    # rewrites this list without the used hash.
    recovery_codes: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    # List[dict] of registered WebAuthn authenticators:
    #   {"credential_id", "public_key", "sign_count", "transports", "label"}.
    webauthn_credentials: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def webauthn_enabled(self) -> bool:
        return bool(self.webauthn_credentials)

    @property
    def is_active(self) -> bool:
        """True once at least one second factor is fully enrolled — i.e. login
        for this user should require an MFA challenge."""
        return self.totp_enabled or self.webauthn_enabled
