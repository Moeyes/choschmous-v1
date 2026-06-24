"""MFA tests (CHOS-401).

Unit coverage of the stdlib TOTP + recovery-code primitives, and integration
coverage of the full enrol → activate → challenged-login → verify flow plus
hard-enforcement for un-enrolled privileged accounts.
"""

import uuid

import pytest

from core.security import hash_password
from src.models.enum.user import UserRole
from src.models.user import User
from src.models.user_mfa import UserMfa
from src.services.mfa import recovery, totp


# ── unit: TOTP ───────────────────────────────────────────────────────────────
def test_totp_roundtrip_and_window():
    secret = totp.generate_secret()
    code = totp.now_code(secret)
    assert totp.verify(secret, code) is True
    # A code from one step ago is accepted within the default ±1 window.
    prev = totp.now_code(secret, at=__import__("time").time() - 30)
    assert totp.verify(secret, prev) is True
    assert totp.verify(secret, "000000", window=0, at=0) is False
    assert totp.verify(secret, "not-a-code") is False


def test_totp_secret_is_base32_and_uri_well_formed():
    secret = totp.generate_secret()
    assert secret == secret.upper().rstrip("=")
    uri = totp.provisioning_uri(secret, account_name="alice", issuer="MoEYS")
    # The label "issuer:account" is percent-encoded in the path.
    assert uri.startswith("otpauth://totp/MoEYS%3Aalice?")
    assert f"secret={secret}" in uri
    assert "issuer=MoEYS" in uri


# ── unit: recovery codes ─────────────────────────────────────────────────────
def test_recovery_codes_generate_hash_and_single_use():
    plaintext, hashed = recovery.generate_codes()
    assert len(plaintext) == len(hashed) == 10
    # plaintext is never equal to its stored hash
    assert all(p not in hashed for p in plaintext)
    # a real code verifies and is consumed (removed from the remaining list)
    remaining = recovery.verify_and_consume(plaintext[0], hashed)
    assert remaining is not None and len(remaining) == 9
    # the same code cannot be used twice
    assert recovery.verify_and_consume(plaintext[0], remaining) is None
    # dashes / spacing / case are normalized
    messy = plaintext[1].lower().replace("-", " ")
    assert recovery.verify_and_consume(messy, hashed) is not None


# ── integration helpers ──────────────────────────────────────────────────────
async def _make_db_user(db, *, role=UserRole.ADMIN, password="ValidPass123"):
    u = User(
        kh_family_name="ស",
        kh_given_name="ស",
        en_family_name="S",
        en_given_name="S",
        email=f"{uuid.uuid4().hex[:10]}@test.local",
        username=f"user_{uuid.uuid4().hex[:10]}",
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(u)
    await db.flush()
    return u


# ── integration: enrol → activate → status ──────────────────────────────────
@pytest.mark.asyncio
async def test_totp_enroll_activate_flow(client, db_session, as_user):
    user = await _make_db_user(db_session)
    as_user(user)

    enroll = await client.post("/api/v1/auth/mfa/totp/enroll")
    assert enroll.status_code == 200
    secret = enroll.json()["secret"]

    # wrong code is rejected
    bad = await client.post("/api/v1/auth/mfa/totp/activate", json={"code": "000000"})
    assert bad.status_code == 401

    good = await client.post(
        "/api/v1/auth/mfa/totp/activate", json={"code": totp.now_code(secret)}
    )
    assert good.status_code == 200
    codes = good.json()["recovery_codes"]
    assert len(codes) == 10

    status = await client.get("/api/v1/auth/mfa/status")
    assert status.json()["totp_enabled"] is True
    assert status.json()["recovery_codes_remaining"] == 10


# ── integration: challenged login + verify ──────────────────────────────────
@pytest.mark.asyncio
async def test_login_requires_second_factor_then_verifies(client, db_session):
    user = await _make_db_user(db_session, password="ValidPass123")
    secret = totp.generate_secret()
    db_session.add(
        UserMfa(user_id=user.id, totp_secret=secret, totp_enabled=True)
    )
    await db_session.flush()

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "ValidPass123"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["mfa_required"] is True
    assert "totp" in body["methods"]
    # No session cookies were issued at the password step.
    assert "access_token=" not in " ".join(login.headers.get_list("set-cookie"))

    # wrong code -> 401
    bad = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": body["mfa_token"], "method": "totp", "code": "000000"},
    )
    assert bad.status_code == 401

    ok = await client.post(
        "/api/v1/auth/mfa/verify",
        json={
            "mfa_token": body["mfa_token"],
            "method": "totp",
            "code": totp.now_code(secret),
        },
    )
    assert ok.status_code == 200
    assert "access_token=" in " ".join(ok.headers.get_list("set-cookie"))


@pytest.mark.asyncio
async def test_recovery_code_satisfies_challenge_once(client, db_session):
    user = await _make_db_user(db_session, password="ValidPass123")
    plaintext, hashed = recovery.generate_codes()
    db_session.add(
        UserMfa(
            user_id=user.id,
            totp_secret=totp.generate_secret(),
            totp_enabled=True,
            recovery_codes=hashed,
        )
    )
    await db_session.flush()

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "ValidPass123"},
    )
    token = login.json()["mfa_token"]

    first = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": token, "method": "recovery", "code": plaintext[0]},
    )
    assert first.status_code == 200

    # The used code was consumed: 9 remain, and it no longer matches. (HTTP-level
    # single-use is awkward to re-drive because a successful verify rotates the
    # CSRF cookie; the service-level consumption is the load-bearing assertion and
    # the pure single-use property is covered by the unit test above.)
    from src.services.mfa.service import MfaService

    remaining = (await MfaService(db_session).get(user.id)).recovery_codes
    assert len(remaining) == 9
    assert recovery.verify_and_consume(plaintext[0], remaining) is None


@pytest.mark.asyncio
async def test_unenrolled_user_logs_in_normally(client, db_session):
    """No behaviour change for users without MFA: password login still issues a
    session directly."""
    user = await _make_db_user(db_session, password="ValidPass123")
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "ValidPass123"},
    )
    assert login.status_code == 200
    assert "access_token=" in " ".join(login.headers.get_list("set-cookie"))
    assert "mfa_required" not in login.json()


@pytest.mark.asyncio
async def test_enforcement_blocks_unenrolled_privileged_user(
    client, db_session, monkeypatch
):
    """With MFA_ENFORCED on, a privileged-role user who has not enrolled is sent
    to enrol before any session is issued."""
    from core.config import settings

    monkeypatch.setattr(settings, "MFA_ENFORCED", True)
    user = await _make_db_user(db_session, role=UserRole.SUPER_ADMIN)

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": "ValidPass123"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["mfa_required"] is True
    assert body["mfa_enrollment_required"] is True
    assert "access_token=" not in " ".join(login.headers.get_list("set-cookie"))
