"""SQLAlchemy column type for transparent field-level PII encryption (CHOS-403).

``EncryptedString`` is a ``TypeDecorator`` over ``String``: it envelope-encrypts
on the way to the DB and decrypts on the way back, so the ORM/application keeps
seeing plaintext while the column stores ciphertext **at rest**. That keeps the
existing masking + audited-reveal behaviour intact — every place that reads
``Enroll.phonenumber`` via the ORM (the reveal endpoint, reports, projections)
transparently gets the cleartext, while the database row, dumps, and backups hold
only ciphertext.

Backward compatible: a value already stored as plaintext (pre-encryption rows) is
detected by the missing ``kms1:`` marker and returned untouched, so turning
encryption on does not require an immediate backfill.
"""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

from app.infrastructure.db.crypto import get_cipher, is_encrypted


class EncryptedString(TypeDecorator):
    # Store ciphertext as text. Envelope ciphertext is markedly larger than the
    # plaintext, so the underlying column must be wide; callers size it for the
    # ciphertext, not the cleartext.
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        # Idempotent: never double-encrypt an already-encrypted value.
        if is_encrypted(value):
            return value
        return get_cipher().encrypt(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return get_cipher().decrypt(value)
