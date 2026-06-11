import re
from passlib.context import CryptContext
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt
from core.config import settings

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


def _build_payload(sub: str, role: str, token_type: str, expires_delta: timedelta, jti: str | None = None) -> Dict[str, Any]:
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
    claims = _build_payload(sub=sub, role=role, token_type="access", expires_delta=expires)
    return jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(sub: str, role: str, jti: str | None = None) -> tuple[str, str]:
    refresh_jti = jti or str(uuid.uuid4())
    expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    claims = _build_payload(sub=sub, role=role, token_type="refresh", expires_delta=expires, jti=refresh_jti)
    encoded = jwt.encode(claims, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded, refresh_jti


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def decode_refresh_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def decode_token(token: str) -> Dict[str, Any]:
    """Attempt access key first, then refresh key (for auth_service compat)."""
    try:
        return decode_access_token(token)
    except jwt.InvalidTokenError:
        return decode_refresh_token(token)


def hash_token_value(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_password_strength(password: str) -> None:
    """Raise ValueError if password does not meet strength requirements."""
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    if len(password) > 128:
        raise ValueError("password must not exceed 128 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("password must contain at least one digit")


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
