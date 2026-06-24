import logging
import uuid
from datetime import datetime, timedelta, timezone
from secrets import compare_digest

from fastapi import HTTPException, Response
from jwt import InvalidTokenError

logger = logging.getLogger(__name__)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password,
    hash_password,
    hash_token_value,
    generate_csrf_token,
)
from core.csrf import CSRF_COOKIE_NAME

from src.models.user import User
from src.models.refresh_token import RefreshToken
from src.services.mfa import challenge as mfa_challenge
from src.services.mfa.service import MfaService, role_requires_mfa


# A precomputed bcrypt hash used to equalize login timing when the username does
# not exist — without it, "no such user" returns far faster than a real bcrypt
# verify, leaking which usernames are valid (user enumeration). Lazily built so
# import stays cheap; uses the same cost factor as real password hashes.
_DUMMY_PASSWORD_HASH: str | None = None


def _dummy_hash() -> str:
    global _DUMMY_PASSWORD_HASH
    if _DUMMY_PASSWORD_HASH is None:
        _DUMMY_PASSWORD_HASH = hash_password(
            "constant-time-equalizer-not-a-real-password"
        )
    return _DUMMY_PASSWORD_HASH


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _set_auth_cookies(
        self, response: Response, access_token: str, refresh_token: str
    ):
        access_max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

        cookie_kwargs = {
            "httponly": True,
            "secure": settings.ENVIRONMENT.lower() != "local",
            "samesite": "lax",
        }

        response.set_cookie(
            "access_token", access_token, max_age=access_max_age, **cookie_kwargs
        )
        response.set_cookie(
            "refresh_token", refresh_token, max_age=refresh_max_age, **cookie_kwargs
        )

        response.set_cookie(
            CSRF_COOKIE_NAME,
            generate_csrf_token(),
            max_age=refresh_max_age,
            httponly=False,
            secure=settings.ENVIRONMENT.lower() != "local",
            samesite="lax",
        )

    def _clear_auth_cookies(self, response: Response):
        cookie_kwargs = {
            "path": "/",
            "httponly": True,
            "secure": settings.ENVIRONMENT.lower() != "local",
            "samesite": "lax",
        }
        response.delete_cookie("access_token", **cookie_kwargs)
        response.delete_cookie("refresh_token", **cookie_kwargs)
        response.delete_cookie(
            CSRF_COOKIE_NAME,
            path="/",
            httponly=False,
            secure=settings.ENVIRONMENT.lower() != "local",
            samesite="lax",
        )

    MAX_FAILED_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    async def login(self, username: str, password: str, response: Response):
        # NOTE: password-strength is validated at registration / password-change
        # (UserService), NOT here. Gating login on the current strength policy
        # would lock out any pre-existing account whose stored password predates
        # the policy. Login only authenticates an existing credential.
        result = await self.db.execute(select(User).where(User.username == username))
        user = result.scalars().first()

        # Always perform exactly one bcrypt verify — against the real hash when
        # the user exists, otherwise against a dummy hash — so the response time
        # is the same whether or not the username exists (no enumeration oracle).
        hashed = user.hashed_password if user else _dummy_hash()
        password_ok = verify_password(password, hashed)

        if (
            user
            and user.locked_until
            and user.locked_until > datetime.now(timezone.utc)
        ):
            remaining = int(
                (user.locked_until - datetime.now(timezone.utc)).total_seconds()
            )
            logger.warning(
                "Login attempt on locked account %s (%ds remaining)",
                username,
                remaining,
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials",
            )

        if not user or not password_ok:
            if user:
                user.failed_attempts = (user.failed_attempts or 0) + 1
                if user.failed_attempts >= self.MAX_FAILED_ATTEMPTS:
                    user.locked_until = datetime.now(timezone.utc) + timedelta(
                        minutes=self.LOCKOUT_DURATION_MINUTES
                    )
                await self.db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if user.failed_attempts or user.locked_until:
            user.failed_attempts = 0
            user.locked_until = None
            await self.db.commit()

        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)

        # ── Second factor (CHOS-401) ────────────────────────────────────────
        # Password is the FIRST factor. If this user has an active MFA enrolment,
        # do NOT issue session cookies yet — return a short-lived challenge token
        # the client trades for cookies at /auth/mfa/verify with a second factor.
        mfa = MfaService(self.db)
        if await mfa.login_requires_second_factor(user):
            return {
                "mfa_required": True,
                "mfa_token": mfa_challenge.create_challenge_token(
                    sub=str(user.id), role=role_value
                ),
                "methods": await self._mfa_methods(mfa, user.id),
            }
        # Hard enforcement: a privileged-role user who has NOT enrolled is sent to
        # enrol before any session is granted (only when MFA_ENFORCED is on).
        if (
            settings.MFA_ENFORCED
            and role_requires_mfa(user)
            and not await mfa.is_enrolled(user.id)
        ):
            return {
                "mfa_required": True,
                "mfa_enrollment_required": True,
                "mfa_token": mfa_challenge.create_challenge_token(
                    sub=str(user.id), role=role_value
                ),
                "methods": [],
            }

        return await self._issue_session(user, role_value, response)

    async def _mfa_methods(self, mfa: MfaService, user_id) -> list[str]:
        record = await mfa.get(user_id)
        methods: list[str] = []
        if record and record.totp_enabled:
            methods.append("totp")
        if record and record.webauthn_enabled:
            methods.append("webauthn")
        if record and record.recovery_codes:
            methods.append("recovery")
        return methods

    async def _issue_session(self, user: User, role_value: str, response: Response):
        """Mint the access+refresh pair, persist the refresh record, and set the
        auth cookies. Shared by password-only login and the post-MFA verify path
        so both flows issue an identical session."""
        access_token = create_access_token(sub=str(user.id), role=role_value)
        refresh_token, jti = create_refresh_token(sub=str(user.id), role=role_value)

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        token_record = RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token_value(refresh_token),
            expires_at=expires_at,
        )
        self.db.add(token_record)
        await self.db.commit()

        self._set_auth_cookies(response, access_token, refresh_token)
        return {
            "detail": "Authenticated successfully",
            # Epoch seconds when the access_token cookie expires. The token itself
            # stays HttpOnly (never in the body); reporting only the expiry lets
            # the client refresh just-in-time instead of eating a 401 on load.
            "access_token_expires_at": self._access_expires_at(),
        }

    async def verify_mfa(
        self,
        *,
        mfa_token: str | None,
        method: str,
        code: str | None,
        response: Response,
        webauthn_credential: dict | None = None,
        webauthn_challenge: str | None = None,
    ):
        """Second leg of an MFA login: validate the challenge token + the supplied
        second factor, then issue the real session. ``method`` is
        ``totp`` | ``recovery`` | ``webauthn``."""
        if not mfa_token:
            raise HTTPException(status_code=401, detail="Missing MFA challenge token")
        try:
            claims = mfa_challenge.decode_challenge_token(mfa_token)
        except InvalidTokenError:
            raise HTTPException(
                status_code=401, detail="MFA challenge expired or invalid"
            )

        sub = claims.get("sub")
        result = await self.db.execute(
            select(User).where(User.id == uuid.UUID(sub))
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        mfa = MfaService(self.db)
        ok = False
        if method == "totp":
            ok = await mfa.verify_totp(user.id, code or "")
        elif method == "recovery":
            ok = await mfa.verify_recovery(user.id, code or "")
        elif method == "webauthn":
            ok = await mfa.verify_webauthn_assertion(
                user.id,
                credential=webauthn_credential or {},
                expected_challenge=webauthn_challenge or "",
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown MFA method")

        if not ok:
            raise HTTPException(status_code=401, detail="Invalid second factor")

        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        return await self._issue_session(user, role_value, response)

    async def complete_oidc_login(self, *, email: str, response: Response):
        """Issue a session for a user identified by a verified OIDC email claim.

        Deliberately does NOT auto-provision: the email must already map to a
        local account (operators are onboarded explicitly). Unknown emails get a
        401 rather than silently creating privileged accounts."""
        if not email:
            raise HTTPException(status_code=401, detail="OIDC token missing email")
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=401, detail="No active account for this identity"
            )
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        return await self._issue_session(user, role_value, response)

    @staticmethod
    def _access_expires_at() -> int:
        """Epoch seconds at which a freshly issued access token expires."""
        return int(
            (
                datetime.now(timezone.utc)
                + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
            ).timestamp()
        )

    async def logout(self, refresh_token: str | None, response: Response):
        if refresh_token:
            try:
                claims = decode_refresh_token(refresh_token)
                jti = claims.get("jti")
                if jti:
                    result = await self.db.execute(
                        select(RefreshToken).where(RefreshToken.jti == jti)
                    )
                    record = result.scalars().first()
                    if record:
                        await self.db.delete(record)
                        await self.db.commit()
            except InvalidTokenError:
                pass

        self._clear_auth_cookies(response)
        return {"detail": "Logged out"}

    async def refresh_tokens(self, refresh_token: str | None, response: Response):
        if not refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token missing")

        try:
            claims = decode_refresh_token(refresh_token)
        except InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        if claims.get("type") != "refresh" or not claims.get("jti"):
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        jti = claims["jti"]

        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )

        record = result.scalars().first()

        if not record or record.expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=401, detail="Refresh token expired or revoked"
            )

        if record.revoked:
            # Token reuse detected — revoke ALL tokens for this user
            sub = claims.get("sub")
            await self.db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == uuid.UUID(sub))
                .values(revoked=True)
            )
            await self.db.commit()
            raise HTTPException(
                status_code=401,
                detail="Session revoked due to token reuse — please log in again",
            )

        if not compare_digest(record.token_hash, hash_token_value(refresh_token)):
            raise HTTPException(status_code=401, detail="Refresh token hash mismatch")

        # revoke old token
        record.revoked = True
        await self.db.commit()

        role = claims.get("role", "guest")
        sub = claims.get("sub")

        new_access = create_access_token(sub=sub, role=role)

        new_refresh, new_jti = create_refresh_token(
            sub=sub,
            role=role,
        )

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

        new_record = RefreshToken(
            user_id=uuid.UUID(sub),
            jti=new_jti,
            token_hash=hash_token_value(new_refresh),
            expires_at=expires_at,
        )

        self.db.add(new_record)
        await self.db.commit()

        self._set_auth_cookies(response, new_access, new_refresh)

        return {
            "detail": "Tokens refreshed successfully",
            "access_token_expires_at": self._access_expires_at(),
        }
