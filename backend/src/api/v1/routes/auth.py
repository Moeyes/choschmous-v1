from fastapi import APIRouter, Depends, Response, Cookie, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from core.ratelimit import login_limiter, refresh_limiter, logout_limiter

from src.database.deps import get_db, get_current_user
from src.models.user import User
from src.models.enum.user import UserRole
from src.schemas.auth import LoginRequest
from src.schemas.user import UserPublic
from src.services.auth_service import AuthService
from src.services.user_service import UserService


router = APIRouter(prefix="", tags=["auth"])


async def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


@router.post("/login")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    **Authenticate user and initiate session.**

    Rate-limited: 5 requests per 60 seconds per IP.

    **Scenario:**
    Used by the frontend login page. If credentials match, the user receives an access token
    and a refresh token is set in a secure `HttpOnly` cookie.

    **Success Response:**
    - `200 OK`: Returns access and refresh token strings.

    **Error Cases:**
    - `401 Unauthorized`: Username or password incorrect.
    - `403 Forbidden`: Account is inactive/disabled.
    - `422 Unprocessable Entity`: Missing or malformed fields in request body.
    """
    await login_limiter.check(request, response=response)
    service = AuthService(db)

    result = await service.login(
        username=payload.username,
        password=payload.password,
        response=response,
    )

    return result


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
):
    """
    **Renew access token via Refresh Cookie.**

    **Scenario:**
    When the access token expires, the client calls this endpoint. It uses the `refresh_token`
    stored in the secure browser cookie to issue a fresh pair of tokens.

    **Success Response:**
    - `200 OK`: Returns new access and refresh token pair.

    **Error Cases:**
    - `401 Unauthorized`: Cookie is missing, token is expired, or token has been revoked.
    """
    await refresh_limiter.check(request, response=response)
    service = AuthService(db)

    result = await service.refresh_tokens(
        refresh_token=refresh_token,
        response=response,
    )

    return result


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
):
    """
    **End the current session.**

    **Scenario:**
    Called by the frontend when the user signs out. Revokes the refresh token
    server-side (so it can no longer mint new access tokens) and clears the
    `access_token` and `refresh_token` cookies.

    **Success Response:**
    - `200 OK`: Session ended. Safe to call even with no/expired session.
    """
    await logout_limiter.check(request, response=response)
    service = AuthService(db)
    return await service.logout(refresh_token=refresh_token, response=response)


@router.get("/session/{user_id}", response_model=UserPublic)
async def get_session(
    user_id: uuid.UUID,
    db_service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    """
    **Retrieve user session details.**

    **Scenario:**
    Used to get user data by ID.

    **Success Response:**
    - `200 OK`: Returns the user data.

    **Error Cases:**
    - `403 Forbidden`: Cannot view another user's profile.
    - `404 Not Found`: User not found.
    """
    if current_user.id != user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="Access denied")
    user = await db_service.get_user(user_id)
    return user


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    **Return the currently authenticated user.**

    **Scenario:**
    Single round-trip "who am I?" — resolves the user straight from the
    `access_token` cookie, with no user id in the URL and no client-side token
    decoding. The frontend uses this to restore a session on load without
    persisting any user data in the browser.

    **Success Response:**
    - `200 OK`: Returns the authenticated user.

    **Error Cases:**
    - `401 Unauthorized`: No/invalid/expired access token cookie.
    """
    return current_user
