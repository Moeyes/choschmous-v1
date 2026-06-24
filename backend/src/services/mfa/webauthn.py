"""WebAuthn (FIDO2) registration/assertion support (CHOS-401).

WebAuthn is the phishing-resistant second factor we want for privileged
government operators. Full attestation/assertion verification requires CBOR +
COSE-key + signature-counter handling that is normally delegated to the
``webauthn``/``fido2`` library — which is **not installable in this offline
environment**. So this module:

  * fully implements the server-side STATE machine that does not need the crypto
    library — challenge generation, options assembly, and credential storage; and
  * isolates the two verification steps that DO need it behind
    ``verify_registration`` / ``verify_assertion``, which raise
    ``WebAuthnUnavailable`` until the library is wired in.

TODO(CHOS-401 / deps): add ``webauthn`` to pyproject and implement the two verify
functions with ``webauthn.verify_registration_response`` /
``verify_authentication_response`` (origin + RP-ID + challenge + sign-count
checks). The endpoints, schemas, storage shape, and tests are already built
around this boundary, so wiring the library in is a localized change.
"""

from __future__ import annotations

import base64
import secrets

from core.config import settings


class WebAuthnUnavailable(Exception):
    """Raised when WebAuthn verification is requested but the crypto library that
    performs attestation/assertion verification is not installed. Maps to HTTP
    501 at the route — the feature is implemented but not yet operational."""


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def new_challenge() -> str:
    """A fresh base64url challenge to embed in registration/assertion options and
    bind into the short-lived MFA challenge token (replay protection)."""
    return _b64url(secrets.token_bytes(32))


def registration_options(*, user_id: str, username: str, challenge: str) -> dict:
    """PublicKeyCredentialCreationOptions for navigator.credentials.create()."""
    return {
        "rp": {"id": settings.WEBAUTHN_RP_ID, "name": settings.WEBAUTHN_RP_NAME},
        "user": {
            "id": _b64url(user_id.encode("utf-8")),
            "name": username,
            "displayName": username,
        },
        "challenge": challenge,
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},  # ES256
            {"type": "public-key", "alg": -257},  # RS256
        ],
        "timeout": 60000,
        "attestation": "none",
        "authenticatorSelection": {
            "userVerification": "preferred",
            "residentKey": "preferred",
        },
    }


def assertion_options(*, challenge: str, allow_credentials: list[str]) -> dict:
    """PublicKeyCredentialRequestOptions for navigator.credentials.get()."""
    return {
        "rpId": settings.WEBAUTHN_RP_ID,
        "challenge": challenge,
        "timeout": 60000,
        "userVerification": "preferred",
        "allowCredentials": [
            {"type": "public-key", "id": cid} for cid in allow_credentials
        ],
    }


def verify_registration(*, credential: dict, expected_challenge: str) -> dict:
    """Verify an attestation response and return the stored-credential dict
    ``{credential_id, public_key, sign_count, transports}``.

    Stubbed pending the WebAuthn library (see module docstring)."""
    raise WebAuthnUnavailable(
        "WebAuthn registration verification requires the 'webauthn' library, "
        "which is not installed in this environment."
    )


def verify_assertion(
    *, credential: dict, expected_challenge: str, stored_credentials: list[dict]
) -> dict:
    """Verify an assertion against the user's stored credentials and return the
    updated credential dict (incremented sign_count).

    Stubbed pending the WebAuthn library (see module docstring)."""
    raise WebAuthnUnavailable(
        "WebAuthn assertion verification requires the 'webauthn' library, "
        "which is not installed in this environment."
    )
