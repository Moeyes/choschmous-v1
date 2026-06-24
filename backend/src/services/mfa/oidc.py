"""OIDC authorization-code + PKCE login against a government IdP (CHOS-401).

Flow:
  1. ``/auth/oidc/login`` -> ``build_authorization_request()`` creates a state +
     PKCE verifier, persists them in a short-lived signed cookie, and redirects
     the browser to the IdP's ``authorization_endpoint``.
  2. The IdP redirects back to ``/auth/oidc/callback`` with ``code`` + ``state``;
     ``exchange_code()`` validates state, swaps the code for tokens at the
     ``token_endpoint`` (sending the PKCE verifier), and ``verify_id_token()``
     validates the ID token signature (JWKS) + issuer/audience/expiry.
  3. The caller maps the verified ``email`` claim to a local ``User`` and issues
     the normal session (see AuthService).

The IdP itself is external infrastructure (TODO+cred notes in config). When
OIDC_* is unconfigured the feature is disabled and these helpers raise
``OidcDisabled`` -> 503 at the route. Network calls use httpx (already a
dependency) and JWKS verification uses PyJWT's ``PyJWKClient``.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import urlencode

import httpx
import jwt

from core.config import settings


class OidcDisabled(Exception):
    """OIDC is not configured (no client id / discovery url)."""


class OidcError(Exception):
    """An OIDC protocol failure (bad token, state mismatch, IdP error)."""


def is_enabled() -> bool:
    return bool(
        settings.OIDC_ENABLED
        and settings.OIDC_CLIENT_ID
        and settings.OIDC_DISCOVERY_URL
    )


def _require_enabled() -> None:
    if not is_enabled():
        raise OidcDisabled("OIDC login is not configured for this environment.")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def new_pkce_pair() -> tuple[str, str]:
    """Return ``(code_verifier, code_challenge)`` (RFC 7636, S256)."""
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def new_state() -> str:
    return _b64url(secrets.token_bytes(16))


async def _discover() -> dict:
    """Fetch + return the IdP's OpenID discovery document."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(str(settings.OIDC_DISCOVERY_URL))
        resp.raise_for_status()
        return resp.json()


def _scopes() -> str:
    raw = [s.strip() for s in settings.OIDC_SCOPES.split(",") if s.strip()]
    if "openid" not in raw:
        raw.insert(0, "openid")
    return " ".join(raw)


async def build_authorization_request(*, state: str, code_challenge: str) -> str:
    """Return the full IdP authorization URL to redirect the browser to."""
    _require_enabled()
    meta = await _discover()
    params = {
        "response_type": "code",
        "client_id": settings.OIDC_CLIENT_ID,
        "redirect_uri": settings.OIDC_REDIRECT_URI,
        "scope": _scopes(),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{meta['authorization_endpoint']}?{urlencode(params)}"


async def exchange_code(*, code: str, code_verifier: str) -> dict:
    """Swap an authorization code for the token response at the token endpoint."""
    _require_enabled()
    meta = await _discover()
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.OIDC_REDIRECT_URI,
        "client_id": settings.OIDC_CLIENT_ID,
        "code_verifier": code_verifier,
    }
    if settings.OIDC_CLIENT_SECRET:
        data["client_secret"] = settings.OIDC_CLIENT_SECRET
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(meta["token_endpoint"], data=data)
    if resp.status_code != 200:
        raise OidcError(f"token endpoint returned {resp.status_code}")
    return resp.json()


async def verify_id_token(id_token: str) -> dict:
    """Validate the ID token's signature (via JWKS) + issuer/audience/expiry and
    return its claims. Raises ``OidcError`` on any failure."""
    _require_enabled()
    meta = await _discover()
    try:
        jwks_client = jwt.PyJWKClient(meta["jwks_uri"])
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.OIDC_CLIENT_ID,
            issuer=meta.get("issuer"),
        )
    except Exception as exc:  # PyJWKClientError / InvalidTokenError / network
        raise OidcError(f"ID token verification failed: {exc}") from exc
    return claims
