"""MFA service — all enrolment/verification logic (CHOS-401).

Thin routes call into this; it owns every ``select``/``commit`` on ``user_mfa``
and returns plain dicts / booleans. Domain failures raise the typed ``MfaError``
(carrying an HTTP ``code``) which the route maps, per the layering standard.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from src.models.user import User
from src.models.user_mfa import UserMfa
from src.services.mfa import recovery, totp, webauthn


class MfaError(Exception):
    """Raised on a bad MFA request. ``code`` is the HTTP status."""

    def __init__(self, message: str, code: int = 400):
        super().__init__(message)
        self.code = code


def role_value(user: User) -> str:
    return getattr(user.role, "value", str(user.role))


def role_requires_mfa(user: User) -> bool:
    """True if this user's role is in the MFA-required set (privileged roles)."""
    return role_value(user).lower() in settings.mfa_required_roles


class MfaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id) -> UserMfa | None:
        result = await self.db.execute(
            select(UserMfa).where(UserMfa.user_id == user_id)
        )
        return result.scalars().first()

    async def _get_or_create(self, user_id) -> UserMfa:
        record = await self.get(user_id)
        if record is None:
            record = UserMfa(user_id=user_id)
            self.db.add(record)
            await self.db.flush()
        return record

    async def is_enrolled(self, user_id) -> bool:
        record = await self.get(user_id)
        return bool(record and record.is_active)

    async def login_requires_second_factor(self, user: User) -> bool:
        """Whether THIS login must present a second factor: the user has an active
        enrolment (always challenged once enrolled)."""
        return await self.is_enrolled(user.id)

    # ── status ──────────────────────────────────────────────────────────────
    async def status(self, user: User) -> dict:
        record = await self.get(user.id)
        return {
            "role_requires_mfa": role_requires_mfa(user),
            "enforced": settings.MFA_ENFORCED,
            "totp_enabled": bool(record and record.totp_enabled),
            "totp_pending": bool(
                record and record.totp_secret and not record.totp_enabled
            ),
            "webauthn_enabled": bool(record and record.webauthn_enabled),
            "webauthn_count": len(record.webauthn_credentials) if record else 0,
            "recovery_codes_remaining": len(record.recovery_codes) if record else 0,
        }

    # ── TOTP enrolment ──────────────────────────────────────────────────────
    async def begin_totp_enroll(self, user: User) -> dict:
        """Create (or replace, if not yet activated) a pending TOTP secret and
        return the provisioning URI for the QR code. Re-enrolling TOTP that is
        already enabled is rejected — disable it first."""
        record = await self._get_or_create(user.id)
        if record.totp_enabled:
            raise MfaError("TOTP is already enabled; disable it before re-enrolling.")
        secret = totp.generate_secret()
        record.totp_secret = secret
        await self.db.commit()
        uri = totp.provisioning_uri(
            secret, account_name=user.username, issuer=settings.MFA_ISSUER
        )
        return {"secret": secret, "otpauth_uri": uri}

    async def activate_totp(self, user: User, code: str) -> dict:
        """Confirm possession of the pending secret with a live code, enable TOTP,
        and return freshly generated one-time recovery codes (shown once)."""
        record = await self.get(user.id)
        if not record or not record.totp_secret:
            raise MfaError("No pending TOTP enrolment; start enrolment first.")
        if record.totp_enabled:
            raise MfaError("TOTP is already enabled.")
        if not totp.verify(record.totp_secret, code):
            raise MfaError("Invalid TOTP code.", code=401)
        record.totp_enabled = True
        plaintext, hashed = recovery.generate_codes()
        record.recovery_codes = hashed
        await self.db.commit()
        return {"recovery_codes": plaintext}

    async def regenerate_recovery_codes(self, user: User) -> dict:
        record = await self.get(user.id)
        if not record or not record.is_active:
            raise MfaError("MFA is not enabled.")
        plaintext, hashed = recovery.generate_codes()
        record.recovery_codes = hashed
        await self.db.commit()
        return {"recovery_codes": plaintext}

    # ── second-factor verification (login challenge) ────────────────────────
    async def verify_totp(self, user_id, code: str) -> bool:
        record = await self.get(user_id)
        if not record or not record.totp_enabled or not record.totp_secret:
            return False
        return totp.verify(record.totp_secret, code)

    async def verify_recovery(self, user_id, code: str) -> bool:
        record = await self.get(user_id)
        if not record or not record.recovery_codes:
            return False
        remaining = recovery.verify_and_consume(code, list(record.recovery_codes))
        if remaining is None:
            return False
        record.recovery_codes = remaining
        await self.db.commit()
        return True

    # ── disable ─────────────────────────────────────────────────────────────
    async def disable(self, user: User, code: str) -> None:
        """Disable all second factors. Requires a valid current TOTP or recovery
        code so a hijacked *session* (without the device) cannot silently strip
        MFA off the account."""
        record = await self.get(user.id)
        if not record or not record.is_active:
            raise MfaError("MFA is not enabled.")
        ok = await self.verify_totp(user.id, code)
        if not ok:
            ok = await self.verify_recovery(user.id, code)
        if not ok:
            raise MfaError("Invalid verification code.", code=401)
        record.totp_enabled = False
        record.totp_secret = None
        record.recovery_codes = []
        record.webauthn_credentials = []
        await self.db.commit()

    # ── WebAuthn (scaffold; verification behind the library boundary) ────────
    async def webauthn_registration_options(self, user: User, challenge: str) -> dict:
        await self._get_or_create(user.id)
        await self.db.commit()
        return webauthn.registration_options(
            user_id=str(user.id), username=user.username, challenge=challenge
        )

    async def webauthn_assertion_options(self, user_id, challenge: str) -> dict:
        record = await self.get(user_id)
        creds = [c["credential_id"] for c in record.webauthn_credentials] if record else []
        return webauthn.assertion_options(
            challenge=challenge, allow_credentials=creds
        )

    async def add_webauthn_credential(
        self, user: User, *, credential: dict, expected_challenge: str
    ) -> None:
        # Raises WebAuthnUnavailable (→ 501) until the library is wired in.
        stored = webauthn.verify_registration(
            credential=credential, expected_challenge=expected_challenge
        )
        record = await self._get_or_create(user.id)
        record.webauthn_credentials = list(record.webauthn_credentials) + [stored]
        await self.db.commit()

    async def verify_webauthn_assertion(
        self, user_id, *, credential: dict, expected_challenge: str
    ) -> bool:
        record = await self.get(user_id)
        if not record or not record.webauthn_credentials:
            return False
        updated = webauthn.verify_assertion(
            credential=credential,
            expected_challenge=expected_challenge,
            stored_credentials=list(record.webauthn_credentials),
        )
        # Persist the incremented signature counter (clone-detection).
        record.webauthn_credentials = [
            updated if c["credential_id"] == updated["credential_id"] else c
            for c in record.webauthn_credentials
        ]
        await self.db.commit()
        return True
