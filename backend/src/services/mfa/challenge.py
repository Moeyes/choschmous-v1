"""Short-lived "password verified, awaiting second factor" token (CHOS-401).

When a password check succeeds for an MFA-enrolled user we must NOT issue session
cookies yet — the second factor is still outstanding. Instead we mint a signed,
short-lived challenge token that says "this subject passed the password step".
The client returns it to ``/auth/mfa/verify`` along with the TOTP/recovery/WebAuthn
proof. The token is stateless (a JWT signed with the access-token key, ``type:
mfa``) so no server-side challenge store is needed; it cannot be used as an access
token because every protected route decodes with the access key AND requires
``type`` to be absent/``access`` via ``get_current_user`` (an mfa token has a
distinct ``type`` and a 5-minute expiry).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from core.config import settings

_MFA_TYPE = "mfa"


def create_challenge_token(*, sub: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": sub,
        "role": role,
        "type": _MFA_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.MFA_CHALLENGE_EXPIRE_MINUTES),
    }
    return jwt.encode(
        claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_challenge_token(token: str) -> dict:
    """Decode + validate a challenge token. Raises ``jwt.InvalidTokenError`` (incl.
    expiry) on any problem, and treats a wrong ``type`` as invalid so an access or
    refresh token can never be replayed here."""
    claims = jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    if claims.get("type") != _MFA_TYPE:
        raise jwt.InvalidTokenError("not an mfa challenge token")
    return claims
