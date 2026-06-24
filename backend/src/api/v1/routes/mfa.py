"""MFA enrolment + second-factor verification routes (CHOS-401).

Mounted at ``/auth/mfa`` WITHOUT a global auth dependency: ``/verify`` is the
second leg of login (the caller has no session yet — it is authenticated by the
short-lived challenge token), while the management endpoints declare
``Depends(get_current_user)`` individually. Routes stay thin: parse → authz dep →
service call → map typed errors.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import login_limiter
from src.database.deps import get_current_user, get_db
from src.models.user import User
from src.schemas.mfa import (
    MfaDisableRequest,
    MfaStatusResponse,
    MfaVerifyRequest,
    RecoveryCodesResponse,
    TotpActivateRequest,
    TotpEnrollResponse,
    WebAuthnRegisterVerifyRequest,
)
from src.services.auth_service import AuthService
from src.services.mfa import challenge as mfa_challenge
from src.services.mfa import webauthn as webauthn_mod
from src.services.mfa.service import MfaError, MfaService

router = APIRouter(prefix="", tags=["mfa"])


@router.post("/verify")
async def verify_mfa(
    request: Request,
    payload: MfaVerifyRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Complete an MFA login. Trades a valid challenge token + second factor for
    session cookies. Rate-limited per IP (a burst signals factor brute-force)."""
    await login_limiter.check(request, response=response)
    service = AuthService(db)
    return await service.verify_mfa(
        mfa_token=payload.mfa_token,
        method=payload.method,
        code=payload.code,
        response=response,
        webauthn_credential=payload.webauthn_credential,
        webauthn_challenge=payload.webauthn_challenge,
    )


@router.get("/status", response_model=MfaStatusResponse)
async def mfa_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await MfaService(db).status(current_user)


@router.post("/totp/enroll", response_model=TotpEnrollResponse)
async def totp_enroll(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Begin TOTP enrolment: returns the secret + otpauth URI for the QR code.
    Not yet active until /totp/activate confirms a live code."""
    try:
        return await MfaService(db).begin_totp_enroll(current_user)
    except MfaError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))


@router.post("/totp/activate", response_model=RecoveryCodesResponse)
async def totp_activate(
    payload: TotpActivateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm the pending TOTP secret with a live code, enabling MFA. Returns
    one-time recovery codes — shown to the user exactly once."""
    try:
        return await MfaService(db).activate_totp(current_user, payload.code)
    except MfaError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))


@router.post("/recovery/regenerate", response_model=RecoveryCodesResponse)
async def regenerate_recovery_codes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await MfaService(db).regenerate_recovery_codes(current_user)
    except MfaError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))


@router.post("/disable")
async def disable_mfa(
    payload: MfaDisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable all second factors. Requires a current TOTP/recovery code so a
    stolen session alone cannot strip MFA off the account."""
    try:
        await MfaService(db).disable(current_user, payload.code)
    except MfaError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))
    return {"detail": "MFA disabled"}


# ── WebAuthn (verification behind the library boundary — 501 until wired) ────
@router.post("/webauthn/registration-options")
async def webauthn_registration_options(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = webauthn_mod.new_challenge()
    options = await MfaService(db).webauthn_registration_options(
        current_user, challenge
    )
    # The client echoes the challenge back on /register; bind it so the server can
    # verify it once the library is wired in.
    return {"options": options, "challenge": challenge}


@router.post("/webauthn/register")
async def webauthn_register(
    payload: WebAuthnRegisterVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await MfaService(db).add_webauthn_credential(
            current_user,
            credential=payload.credential,
            expected_challenge=payload.challenge,
        )
    except webauthn_mod.WebAuthnUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except MfaError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))
    return {"detail": "WebAuthn credential registered"}


@router.post("/webauthn/assertion-options")
async def webauthn_assertion_options(
    payload: MfaVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Assertion options for the LOGIN flow — identifies the user from the
    challenge token (no session yet)."""
    try:
        claims = mfa_challenge.decode_challenge_token(payload.mfa_token)
    except Exception:
        raise HTTPException(status_code=401, detail="MFA challenge expired or invalid")
    import uuid

    challenge = webauthn_mod.new_challenge()
    options = await MfaService(db).webauthn_assertion_options(
        uuid.UUID(claims["sub"]), challenge
    )
    return {"options": options, "challenge": challenge}
