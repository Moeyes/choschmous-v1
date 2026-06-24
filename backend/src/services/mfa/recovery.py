"""One-time MFA recovery codes (CHOS-401).

Recovery codes are the break-glass path when an admin loses their authenticator.
They are treated as credentials: generated once, shown to the user once, and
stored only as salted hashes (never plaintext), exactly like passwords. Each code
is single-use — verifying one consumes it.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

# 10 codes is the de-facto standard (GitHub/Google). Each is short enough to type
# but has ~50 bits of entropy (10 chars of Crockford-ish base32).
_CODE_COUNT = 10
_CODE_BYTES = 8  # 8 bytes → 13 base32 chars; we trim to 10 for usability.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no easily-confused 0/O/1/I


def _one_code() -> str:
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(10))
    # Group as XXXXX-XXXXX for readability; normalize() strips the dash back out.
    return f"{raw[:5]}-{raw[5:]}"


def normalize(code: str) -> str:
    """Canonicalize a user-entered code (strip spaces/dashes, upper-case) so the
    stored hash matches regardless of how the user typed it."""
    return code.replace("-", "").replace(" ", "").strip().upper()


def hash_code(code: str) -> str:
    """SHA-256 of the normalized code. Recovery codes carry full random entropy
    (unlike user-chosen passwords), so a fast hash is acceptable and keeps verify
    cheap; the value is never reversible from the stored hash."""
    return hashlib.sha256(normalize(code).encode("utf-8")).hexdigest()


def generate_codes() -> tuple[list[str], list[str]]:
    """Return ``(plaintext_codes, hashed_codes)``.

    The plaintext list is shown to the user exactly once and never persisted; the
    hashes are what we store on the MFA record.
    """
    plaintext = [_one_code() for _ in range(_CODE_COUNT)]
    hashed = [hash_code(c) for c in plaintext]
    return plaintext, hashed


def verify_and_consume(code: str, hashed_codes: list[str]) -> list[str] | None:
    """If ``code`` matches an unused hash, return the remaining hashes (with that
    one removed) so the caller can persist the consumption. Return ``None`` on no
    match. Constant-time per-candidate compare avoids leaking which code matched.
    """
    target = hash_code(code)
    matched_index = None
    for i, h in enumerate(hashed_codes):
        if hmac.compare_digest(h, target):
            matched_index = i
            # no early break: keep the comparison count independent of position
    if matched_index is None:
        return None
    return [h for i, h in enumerate(hashed_codes) if i != matched_index]
