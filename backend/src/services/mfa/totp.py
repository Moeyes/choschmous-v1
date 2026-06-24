"""RFC 6238 TOTP, implemented with the standard library only (CHOS-401).

The deployment is network-isolated, so ``pyotp`` is not installable here. TOTP
is a small, well-specified algorithm (HMAC-SHA1 over a time counter, RFC 6238 /
RFC 4226), so we implement it directly rather than take a dependency. The output
is byte-for-byte interoperable with Google Authenticator / Authy / 1Password,
which is the whole point of TOTP.

Secrets are Base32 (RFC 4648, no padding) so they paste cleanly into an
authenticator and encode into an ``otpauth://`` provisioning URI / QR code.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

# 20 bytes = 160 bits → the RFC 4226 recommended shared-secret length, and what
# Google Authenticator emits. Base32 of 20 bytes is 32 chars (no padding).
_SECRET_BYTES = 20
_DIGITS = 6
_PERIOD = 30
_ALGORITHM = "SHA1"  # what every mainstream authenticator app assumes


def generate_secret() -> str:
    """Return a fresh Base32 (unpadded, upper-case) TOTP secret."""
    raw = secrets.token_bytes(_SECRET_BYTES)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _b32decode(secret: str) -> bytes:
    # Authenticator secrets are case-insensitive and stored unpadded; restore the
    # padding b32decode requires and upper-case before decoding.
    s = secret.strip().replace(" ", "").upper()
    pad = (-len(s)) % 8
    return base64.b32decode(s + ("=" * pad))


def _hotp(secret: str, counter: int, digits: int = _DIGITS) -> str:
    key = _b32decode(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    # Dynamic truncation (RFC 4226 §5.3).
    offset = digest[-1] & 0x0F
    code_int = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code_int % (10**digits)).zfill(digits)


def now_code(secret: str, *, at: float | None = None) -> str:
    """Return the current TOTP code — used in tests and for QR self-verification."""
    counter = int((at if at is not None else time.time()) // _PERIOD)
    return _hotp(secret, counter)


def verify(secret: str, code: str, *, window: int = 1, at: float | None = None) -> bool:
    """Constant-time verify a submitted code, tolerating ``window`` steps of
    clock skew on either side (RFC 6238 §5.2 recommends a small window)."""
    if not code or not code.isdigit():
        return False
    counter = int((at if at is not None else time.time()) // _PERIOD)
    for drift in range(-window, window + 1):
        candidate = _hotp(secret, counter + drift)
        # compare_digest to avoid a timing oracle on the code value.
        if hmac.compare_digest(candidate, code):
            return True
    return False


def provisioning_uri(secret: str, *, account_name: str, issuer: str) -> str:
    """Build the ``otpauth://totp/...`` URI an authenticator app imports."""
    label = quote(f"{issuer}:{account_name}")
    params = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": _ALGORITHM,
            "digits": _DIGITS,
            "period": _PERIOD,
        }
    )
    return f"otpauth://totp/{label}?{params}"
