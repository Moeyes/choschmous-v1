"""Envelope encryption for field-level PII at rest (CHOS-403).

Design (envelope encryption, the standard KMS pattern):

    plaintext --(DEK, AEAD)--> ciphertext
    DEK       --(KEK, KMS)----> wrapped DEK          (the "envelope")
    stored = "kms1:" + base64( version | len(wrappedDEK) | wrappedDEK | ct )

A fresh random **data key (DEK)** encrypts each value; the DEK itself is wrapped
by a **key-encryption key (KEK)** held by the KMS. To decrypt, the KMS unwraps
the DEK and the DEK decrypts the value. Rotating the KEK only re-wraps DEKs, not
the data.

### Why a hand-rolled AEAD here
The mandated primitive is AES-GCM via a real KMS (AWS KMS ``GenerateDataKey`` /
``Decrypt``). But this environment is **network-isolated**: ``cryptography`` (and
boto3) cannot be installed, and there is no KMS endpoint. The Python standard
library ships no AES. So the LOCAL provider implements an authenticated cipher
from stdlib HMAC only — an encrypt-then-MAC stream cipher (HMAC-SHA256 in counter
mode as the keystream, HMAC-SHA256 as the authenticator). This is a sound
construction (key-separated, nonce'd, authenticated) and keeps the data encrypted
at rest with a swappable boundary — but it is the DEV/offline cipher.

TODO(infra / CHOS-403): in deployed environments, swap ``LocalKms`` for
``AwsKmsProvider`` (boto3 ``generate_data_key`` / ``decrypt``) and the local AEAD
for AES-256-GCM (``cryptography``). The envelope format + ``PiiCipher`` API are
unchanged by that swap; only the provider/cipher internals change. Inject
``PII_ENCRYPTION_KEY`` (or KMS key id + creds) from Vault.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
from abc import ABC, abstractmethod

# Marker prefix on every stored ciphertext. Its absence means the stored value is
# legacy plaintext (pre-encryption rows / a value written before the column was
# encrypted), which the type layer returns untouched — so enabling encryption is
# backward compatible and a backfill can run lazily.
_PREFIX = "kms1:"
_VERSION = 1
_NONCE_LEN = 16
_TAG_LEN = 32
_DEK_LEN = 32


class IntegrityError(Exception):
    """Raised when an authenticated decrypt fails its MAC check (tampering or
    wrong key)."""


# ── stdlib authenticated cipher (encrypt-then-MAC) ───────────────────────────
def _subkeys(key: bytes) -> tuple[bytes, bytes]:
    enc = hmac.new(key, b"moeys-pii-enc", hashlib.sha256).digest()
    mac = hmac.new(key, b"moeys-pii-mac", hashlib.sha256).digest()
    return enc, mac


def _keystream(enc_key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(
            enc_key, nonce + struct.pack(">Q", counter), hashlib.sha256
        ).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def _aead_encrypt(key: bytes, plaintext: bytes) -> bytes:
    enc_key, mac_key = _subkeys(key)
    nonce = os.urandom(_NONCE_LEN)
    ks = _keystream(enc_key, nonce, len(plaintext))
    ct = bytes(p ^ k for p, k in zip(plaintext, ks))
    tag = hmac.new(mac_key, nonce + ct, hashlib.sha256).digest()
    return nonce + ct + tag


def _aead_decrypt(key: bytes, blob: bytes) -> bytes:
    if len(blob) < _NONCE_LEN + _TAG_LEN:
        raise IntegrityError("ciphertext too short")
    enc_key, mac_key = _subkeys(key)
    nonce, ct, tag = (
        blob[:_NONCE_LEN],
        blob[_NONCE_LEN:-_TAG_LEN],
        blob[-_TAG_LEN:],
    )
    expected = hmac.new(mac_key, nonce + ct, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, tag):
        raise IntegrityError("authentication failed (tampered or wrong key)")
    ks = _keystream(enc_key, nonce, len(ct))
    return bytes(c ^ k for c, k in zip(ct, ks))


# ── KMS provider boundary ────────────────────────────────────────────────────
class KmsProvider(ABC):
    """Wraps/unwraps data keys. The only thing that changes between dev and prod."""

    @abstractmethod
    def wrap(self, dek: bytes) -> bytes: ...

    @abstractmethod
    def unwrap(self, wrapped: bytes) -> bytes: ...


class LocalKms(KmsProvider):
    """Dev/offline KMS: the KEK lives in-process (from ``PII_ENCRYPTION_KEY`` or a
    deterministic dev derivation). Wrapping is the same AEAD used for values."""

    def __init__(self, kek: bytes):
        self._kek = kek

    def wrap(self, dek: bytes) -> bytes:
        return _aead_encrypt(self._kek, dek)

    def unwrap(self, wrapped: bytes) -> bytes:
        return _aead_decrypt(self._kek, wrapped)


class AwsKmsProvider(KmsProvider):  # pragma: no cover - needs boto3 + a live KMS
    """Production KMS provider. TODO(infra): implement with boto3
    ``kms.generate_data_key`` / ``kms.decrypt`` once boto3 is available and a KMS
    key id + IAM creds are injected. Raises until then so a misconfigured prod
    fails closed rather than silently storing plaintext."""

    def __init__(self, key_id: str):
        self._key_id = key_id

    def wrap(self, dek: bytes) -> bytes:
        raise NotImplementedError(
            "AwsKmsProvider requires boto3 + a live KMS key (TODO CHOS-403 infra)."
        )

    def unwrap(self, wrapped: bytes) -> bytes:
        raise NotImplementedError(
            "AwsKmsProvider requires boto3 + a live KMS key (TODO CHOS-403 infra)."
        )


# ── the cipher used by the column type ───────────────────────────────────────
class PiiCipher:
    """Envelope encrypt/decrypt of a single string value, using a KMS provider."""

    def __init__(self, kms: KmsProvider):
        self._kms = kms

    def encrypt(self, plaintext: str) -> str:
        dek = os.urandom(_DEK_LEN)
        ct = _aead_encrypt(dek, plaintext.encode("utf-8"))
        wrapped = self._kms.wrap(dek)
        body = struct.pack(">BH", _VERSION, len(wrapped)) + wrapped + ct
        return _PREFIX + base64.b64encode(body).decode("ascii")

    def decrypt(self, stored: str) -> str:
        if not is_encrypted(stored):
            # Legacy plaintext (pre-encryption row) — return as-is.
            return stored
        body = base64.b64decode(stored[len(_PREFIX) :])
        version, wlen = struct.unpack(">BH", body[:3])
        if version != _VERSION:
            raise IntegrityError(f"unknown envelope version {version}")
        wrapped = body[3 : 3 + wlen]
        ct = body[3 + wlen :]
        dek = self._kms.unwrap(wrapped)
        return _aead_decrypt(dek, ct).decode("utf-8")


def is_encrypted(stored: str | None) -> bool:
    return isinstance(stored, str) and stored.startswith(_PREFIX)


# ── process-wide cipher (lazy; reads settings) ───────────────────────────────
_cipher: PiiCipher | None = None


def _derive_local_kek() -> bytes:
    """Resolve the local KEK.

    Order: explicit ``PII_ENCRYPTION_KEY`` (base64, >=32 bytes) → else, in
    non-local environments, FAIL (no silent weak key) → else (local/CI dev) a
    deterministic key derived from the JWT secret so tests/dev round-trip with no
    extra config.
    """
    from core.config import settings

    raw = getattr(settings, "PII_ENCRYPTION_KEY", None)
    if raw:
        key = base64.b64decode(raw)
        if len(key) < 32:
            raise ValueError("PII_ENCRYPTION_KEY must decode to >= 32 bytes")
        return key
    if settings.ENVIRONMENT.lower() != "local":
        raise ValueError(
            "PII_ENCRYPTION_KEY must be set (KMS-injected) in non-local "
            "environments — refusing to encrypt PII with a derived dev key."
        )
    # Local/CI only: deterministic derivation so the test DB round-trips.
    return hashlib.sha256(
        (settings.JWT_SECRET_KEY + "::pii-kek").encode("utf-8")
    ).digest()


def get_cipher() -> PiiCipher:
    global _cipher
    if _cipher is None:
        from core.config import settings

        provider = getattr(settings, "PII_KMS_PROVIDER", "local").lower()
        if provider == "aws":
            kms: KmsProvider = AwsKmsProvider(
                getattr(settings, "PII_KMS_KEY_ID", "") or ""
            )
        else:
            kms = LocalKms(_derive_local_kek())
        _cipher = PiiCipher(kms)
    return _cipher
