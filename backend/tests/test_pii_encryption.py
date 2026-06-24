"""Field-level PII encryption tests (CHOS-403).

Proves: the envelope cipher round-trips and is authenticated (tamper → error);
the EncryptedString column stores CIPHERTEXT at rest while the ORM reads back
PLAINTEXT (so masking + the audited reveal are unaffected).
"""

from datetime import date

import pytest
from sqlalchemy import select, text

from app.infrastructure.db.crypto import (
    IntegrityError,
    is_encrypted,
    get_cipher,
)
from app.application.participants import RevealParticipantPii
from src.models.enroll import Enroll
from src.models.enum.user import IdDocumentType, genderEnum


# ── unit: the envelope cipher ────────────────────────────────────────────────
def test_cipher_roundtrip_and_marker():
    c = get_cipher()
    blob = c.encrypt("012-345-678")
    assert is_encrypted(blob)
    assert blob.startswith("kms1:")
    assert "012-345-678" not in blob  # plaintext is not visible in the ciphertext
    assert c.decrypt(blob) == "012-345-678"


def test_cipher_is_authenticated_tamper_detected():
    c = get_cipher()
    blob = c.encrypt("sensitive")
    # Flip a character in the base64 body → MAC check must fail on decrypt.
    tampered = blob[:-2] + ("A" if blob[-1] != "A" else "B")
    with pytest.raises((IntegrityError, Exception)):
        c.decrypt(tampered)


def test_legacy_plaintext_passes_through():
    # A value stored before encryption (no marker) is returned untouched.
    assert get_cipher().decrypt("0123456789") == "0123456789"


def test_each_encryption_uses_a_fresh_data_key():
    c = get_cipher()
    a, b = c.encrypt("same"), c.encrypt("same")
    assert a != b  # random DEK + nonce → different ciphertext each time
    assert c.decrypt(a) == c.decrypt(b) == "same"


# ── integration: ciphertext at rest, plaintext via ORM ───────────────────────
async def _make_enroll(db, *, phone="012345678", nid="N0012345"):
    e = Enroll(
        kh_family_name="ស",
        kh_given_name="ស",
        en_family_name="S",
        en_given_name="S",
        phonenumber=phone,
        national_id=nid,
        gender=genderEnum.MALE,
        date_of_birth=date(2000, 1, 1),
        id_document_type=IdDocumentType.CAM_NID,
    )
    db.add(e)
    await db.flush()
    return e


@pytest.mark.asyncio
async def test_phone_and_nid_ciphertext_at_rest_plaintext_via_orm(db_session):
    e = await _make_enroll(db_session, phone="012999888", nid="N5550001")
    enroll_id = e.id  # capture before expire_all() (avoids a sync lazy-load)

    # RAW column values (text() bypasses the EncryptedString type) → ciphertext.
    raw = (
        await db_session.execute(
            text("SELECT phonenumber, national_id FROM enrollments WHERE id = :id"),
            {"id": enroll_id},
        )
    ).one()
    assert raw[0].startswith("kms1:") and "012999888" not in raw[0]
    assert raw[1].startswith("kms1:") and "N5550001" not in raw[1]

    # ORM column read (type-processed) → plaintext.
    db_session.expire_all()
    orm = (
        await db_session.execute(
            select(Enroll.phonenumber, Enroll.national_id).where(
                Enroll.id == enroll_id
            )
        )
    ).one()
    assert orm[0] == "012999888"
    assert orm[1] == "N5550001"


@pytest.mark.asyncio
async def test_reveal_use_case_returns_plaintext(db_session):
    """The audited reveal path is unchanged: it still yields the cleartext phone
    (decrypted transparently from the encrypted column)."""
    e = await _make_enroll(db_session, phone="0700112233")
    phone = await RevealParticipantPii(db_session).get_phone(e.id)
    assert phone == "0700112233"
