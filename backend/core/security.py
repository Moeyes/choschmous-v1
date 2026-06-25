import logging
import re
from passlib.context import CryptContext
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import httpx
import jwt
from core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
)


def hash_password(password: str) -> str:
    if isinstance(password, str):
        password_bytes = password.encode("utf-8")
    else:
        password_bytes = password
    if len(password_bytes) > 72:
        password_bytes = hashlib.sha256(password_bytes).hexdigest().encode("utf-8")
    return pwd_context.hash(password_bytes)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _build_payload(
    sub: str,
    role: str,
    token_type: str,
    expires_delta: timedelta,
    jti: str | None = None,
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    exp = now + expires_delta
    payload: Dict[str, Any] = {
        "sub": sub,
        "role": role,
        "type": token_type,
        "exp": exp,
        "iat": now,
    }
    if jti:
        payload["jti"] = jti
    return payload


def create_access_token(sub: str, role: str) -> str:
    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    claims = _build_payload(
        sub=sub, role=role, token_type="access", expires_delta=expires
    )
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    sub: str, role: str, jti: str | None = None
) -> tuple[str, str]:
    refresh_jti = jti or str(uuid.uuid4())
    expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    claims = _build_payload(
        sub=sub, role=role, token_type="refresh", expires_delta=expires, jti=refresh_jti
    )
    encoded = jwt.encode(
        claims, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded, refresh_jti


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


def decode_refresh_token(token: str) -> Dict[str, Any]:
    return jwt.decode(
        token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


def decode_token(token: str) -> Dict[str, Any]:
    """Attempt access key first, then refresh key (for auth_service compat)."""
    try:
        return decode_access_token(token)
    except jwt.InvalidTokenError:
        return decode_refresh_token(token)


def hash_token_value(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# Passwords that satisfy the naive complexity rules below but are still trivially
# guessed. This is a small curated denylist, NOT a full breach corpus — for
# ASVS-grade coverage, additionally screen new passwords against a breached-
# password set (e.g. the HaveIBeenPwned k-anonymity range API) at the
# registration / change call site in UserService.
_COMMON_WEAK_PASSWORDS = frozenset(
    {
        "password1234",
        "passw0rd1234",
        "p@ssw0rd1234",
        "welcome123456",
        "qwerty123456",
        "admin1234567",
        "letmein12345",
        "iloveyou1234",
        "changeme1234",
        "1q2w3e4r5t6y",
    }
)


def validate_password_strength(password: str) -> None:
    """Raise ValueError if a password does not meet strength requirements.

    Policy raised to ASVS 5.0 L1 for this public-sector system: minimum 12
    characters, mixed case + digit, and not a well-known weak password. Enforced
    at registration / password-change only (never at login), so existing
    credentials predating this policy are not locked out.
    """
    if len(password) < 12:
        raise ValueError("password must be at least 12 characters")
    if len(password) > 128:
        raise ValueError("password must not exceed 128 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("password must contain at least one digit")
    if password.lower() in _COMMON_WEAK_PASSWORDS:
        raise ValueError("password is too common; choose a less predictable password")


# ── CHOS-505: breached-password screening (HaveIBeenPwned, k-anonymity) ──────
# The small denylist above only catches a handful of obvious passwords. ASVS 5.0
# (V2) wants new passwords checked against a real breach corpus. HIBP's Pwned
# Passwords range API lets us do that WITHOUT sending the password (or its full
# hash) anywhere: we SHA-1 the password, send only the first 5 hex chars of the
# digest, and HIBP returns every breached-hash suffix sharing that prefix. We
# match the suffix locally. The server never learns which password we asked
# about (k-anonymity).
_HIBP_RANGE_PADDING_HEADER = {"Add-Padding": "true"}  # mask response size


def _password_breach_count(password: str, range_text: str) -> int:
    """Pure matcher: given an HIBP range response, how many breaches contain it.

    ``range_text`` is the body returned by ``GET /range/<prefix>`` — newline-
    separated ``HASH_SUFFIX:COUNT`` lines. With Add-Padding on, HIBP injects
    decoy lines with ``COUNT == 0`` which we ignore. Matching is the full SHA-1:
    prefix (first 5 hex chars) is implied by the endpoint, suffix is the rest.
    """
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    suffix = digest[5:]
    for line in range_text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        candidate, _, count_str = line.partition(":")
        if candidate.strip().upper() == suffix:
            try:
                return int(count_str.strip())
            except ValueError:
                return 0
    return 0


async def screen_breached_password(
    password: str, *, client: httpx.AsyncClient | None = None
) -> None:
    """Raise ``ValueError`` if a password appears in the HIBP breach corpus.

    No-op unless ``HIBP_ENABLED`` (default False) — so local/CI and offline
    environments are unaffected, mirroring MFA_ENFORCED / MINOR_CONSENT_ENFORCED.

    **Fails open**: if HIBP is unreachable or errors, we log and return without
    raising. A breach-corpus check is a hardening control, not an availability-
    critical one — an outage at HIBP must not block citizens from registering.
    """
    if not settings.HIBP_ENABLED:
        return

    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix = digest[:5]
    url = f"{settings.HIBP_API_URL.rstrip('/')}/{prefix}"

    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=settings.HIBP_TIMEOUT_SECONDS)
    try:
        resp = await client.get(url, headers=_HIBP_RANGE_PADDING_HEADER)
        resp.raise_for_status()
        range_text = resp.text
    except (httpx.HTTPError, httpx.InvalidURL) as exc:  # network / 5xx / timeout
        logger.warning("HIBP breach screening unavailable, failing open: %s", exc)
        return
    finally:
        if owns_client:
            await client.aclose()

    if _password_breach_count(password, range_text) > settings.HIBP_MAX_BREACH_COUNT:
        # Never log the password; the message must not echo it either.
        raise ValueError(
            "password has appeared in a known data breach; choose a different one"
        )


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
