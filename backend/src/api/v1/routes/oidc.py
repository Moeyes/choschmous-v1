"""OIDC login routes for a government IdP (CHOS-401).

Authorization-code + PKCE. ``/login`` stashes the ``state`` + PKCE verifier in a
short-lived, HttpOnly, signed cookie and redirects to the IdP; ``/callback``
validates state, exchanges the code, verifies the ID token, maps the verified
email to a local account, and issues the normal session.

The IdP is external infrastructure (TODO+cred notes in core/config). When OIDC is
unconfigured every route returns 503 so password+MFA login is unaffected.
"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from src.database.deps import get_db
from src.services.auth_service import AuthService
from src.services.mfa import oidc

router = APIRouter(prefix="", tags=["oidc"])

_TX_COOKIE = "oidc_tx"


def _seal_tx(state: str, code_verifier: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "state": state,
            "cv": code_verifier,
            "type": "oidc_tx",
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def _open_tx(token: str) -> dict:
    claims = jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
    if claims.get("type") != "oidc_tx":
        raise jwt.InvalidTokenError("wrong token type")
    return claims


@router.get("/login")
async def oidc_login(response: Response):
    if not oidc.is_enabled():
        raise HTTPException(status_code=503, detail="OIDC login is not configured")
    state = oidc.new_state()
    verifier, challenge = oidc.new_pkce_pair()
    url = await oidc.build_authorization_request(
        state=state, code_challenge=challenge
    )
    redirect = RedirectResponse(url=url, status_code=302)
    redirect.set_cookie(
        _TX_COOKIE,
        _seal_tx(state, verifier),
        max_age=600,
        httponly=True,
        secure=settings.ENVIRONMENT.lower() != "local",
        samesite="lax",
    )
    return redirect


@router.get("/callback")
async def oidc_callback(
    response: Response,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
    oidc_tx: str | None = Cookie(default=None, alias=_TX_COOKIE),
):
    if not oidc.is_enabled():
        raise HTTPException(status_code=503, detail="OIDC login is not configured")
    if not oidc_tx:
        raise HTTPException(status_code=400, detail="Missing OIDC transaction")
    try:
        tx = _open_tx(oidc_tx)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Invalid OIDC transaction")
    if tx.get("state") != state:
        raise HTTPException(status_code=400, detail="OIDC state mismatch")

    try:
        tokens = await oidc.exchange_code(code=code, code_verifier=tx["cv"])
        claims = await oidc.verify_id_token(tokens["id_token"])
    except oidc.OidcDisabled:
        raise HTTPException(status_code=503, detail="OIDC login is not configured")
    except (oidc.OidcError, KeyError) as exc:
        raise HTTPException(status_code=401, detail=f"OIDC login failed: {exc}")

    result = await AuthService(db).complete_oidc_login(
        email=(claims.get("email") or "").strip().lower(), response=response
    )
    # Clear the one-shot transaction cookie now it has been consumed.
    response.delete_cookie(_TX_COOKIE, path="/")
    return result
