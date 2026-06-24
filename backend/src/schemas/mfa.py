"""Pydantic schemas for MFA + OIDC (CHOS-401)."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class MfaVerifyRequest(BaseModel):
    """Second-factor proof presented after a password login returned
    ``mfa_required``."""

    mfa_token: str
    method: Literal["totp", "recovery", "webauthn"] = "totp"
    # Present for totp / recovery; absent for webauthn (which sends a credential).
    code: Optional[str] = None
    webauthn_credential: Optional[dict[str, Any]] = None
    webauthn_challenge: Optional[str] = None


class TotpActivateRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=10)


class MfaDisableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=20)


class TotpEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str


class RecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]


class MfaStatusResponse(BaseModel):
    role_requires_mfa: bool
    enforced: bool
    totp_enabled: bool
    totp_pending: bool
    webauthn_enabled: bool
    webauthn_count: int
    recovery_codes_remaining: int

    model_config = ConfigDict(from_attributes=True)


class WebAuthnRegisterVerifyRequest(BaseModel):
    credential: dict[str, Any]
    challenge: str
