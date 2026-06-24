"""Multi-factor authentication (CHOS-401).

Stdlib-only TOTP + one-time recovery codes, a WebAuthn scaffold (verification
behind a library boundary), an OIDC authorization-code/PKCE client for the
government IdP, and a short-lived password-verified challenge token. The
``MfaService`` owns all ``user_mfa`` persistence.
"""

from src.services.mfa import challenge, oidc, recovery, totp, webauthn
from src.services.mfa.service import MfaError, MfaService, role_requires_mfa

__all__ = [
    "MfaService",
    "MfaError",
    "role_requires_mfa",
    "challenge",
    "oidc",
    "recovery",
    "totp",
    "webauthn",
]
