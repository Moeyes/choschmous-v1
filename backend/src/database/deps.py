import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
import uuid

from fastapi import Depends, HTTPException, Cookie
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import ReadSessionLocal, SessionLocal
from core.security import decode_access_token
from src.models.user import User
from src.models.enum.user import UserRole

logger = logging.getLogger(__name__)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Primary (writable) session. Use for any handler that mutates state, and for
    reads that must see the caller's own just-committed writes."""
    async with SessionLocal() as db:
        yield db


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """Read-replica session (CHOS-301).

    Routes read-only traffic — dashboards, reports, and list/search reads — to the
    read replicas (via PgBouncer) so it never competes with writes on the primary.
    Falls back to the primary session in single-DB dev / CI / test, so it is always
    safe to depend on. Do NOT use for handlers that write: a replica is read-only
    and lags the primary slightly, so it must not back read-after-write flows."""
    async with ReadSessionLocal() as db:
        yield db


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias="access_token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        claims = decode_access_token(access_token)

        user_id = claims.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        token_iat = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
        if user.token_valid_from and token_iat < user.token_valid_from:
            raise HTTPException(
                status_code=401,
                detail="Token revoked. Please log in again.",
            )

        return user
    except HTTPException:
        # Expected auth failure (missing/invalid/expired/revoked token). Re-raise
        # without a stack trace — these are routine and logging .exception() on
        # every one floods the logs (and inflates log costs) under load.
        raise
    except Exception as exc:
        # Unexpected error (malformed token, decode bug, DB issue) — log at
        # debug with the cause but still return a generic 401 to the client.
        logger.debug("Authentication failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow only ADMIN / SUPER_ADMIN. 403 for everyone else."""
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=403, detail="Admin access required for this action."
        )
    return current_user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Allow only SUPER_ADMIN. 403 for everyone else."""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403, detail="Super admin access required for this action."
        )
    return current_user


async def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """
    Allow ADMIN / SUPER_ADMIN / FEDERATION (cross-org staff roles).
    Block plain ORGANIZATION users — they may only act on their own org's data
    via enforce_org_access, not manage global resources (events, sport links).
    """
    if current_user.role == UserRole.ORGANIZATION:
        raise HTTPException(
            status_code=403, detail="Staff access required for this action."
        )
    return current_user


def get_effective_org_id(
    current_user: User, client_org_id: Optional[int]
) -> Optional[int]:
    """
    Return the organization_id that a query should be filtered by.

    - organization role: always force own org_id, silently ignore client param
    - admin / super_admin / federation: trust the optional client filter
    """
    if current_user.role == UserRole.ORGANIZATION:
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your account has no organization linked. Contact an admin.",
            )
        return current_user.organization_id
    return client_org_id


def get_effective_sport_id(
    current_user: User, client_sport_id: int | None = None
) -> int | None:
    """
    Return the sport_id that a query should be filtered by.

    - FEDERATION role: always force own sport_id, silently ignore client param.
      Raises 400 if the federation user has no sport linked.
    - ORGANIZATION role: raise 403 (org users cannot manage sports).
    - admin / super_admin: trust the optional client filter.
    """
    if current_user.role == UserRole.FEDERATION:
        if current_user.sport_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your federation account has no sport linked. Contact an admin.",
            )
        return current_user.sport_id
    if current_user.role == UserRole.ORGANIZATION:
        raise HTTPException(
            status_code=403,
            detail="Organization users cannot manage sport-level resources.",
        )
    return client_sport_id


def enforce_org_access(current_user: User, requested_org_id: int) -> int:
    """
    For path-param org_id routes: verify the caller is allowed to access that org.
    Returns the authorised org_id to use.

    - organization role: must match their own org; 403 otherwise
    - admin / super_admin / federation: pass through
    """
    if current_user.role == UserRole.ORGANIZATION:
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your account has no organization linked. Contact an admin.",
            )
        if current_user.organization_id != requested_org_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: you can only access your own organization's data.",
            )
    return requested_org_id
