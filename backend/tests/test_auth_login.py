"""Authentication tests (P1-4 strength gate removed, P1-5 timing-safe).

Covers: successful login, wrong password, legacy weak-password accounts logging
in normally, account lockout, unknown-user enumeration safety, and that a bcrypt
verify always runs (constant-time path) even for non-existent users.
"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from core import ratelimit
from core.database import DATABASE_URL
from core.security import hash_password
from src.models.enum.user import UserRole
from src.models.user import User


@pytest_asyncio.fixture(autouse=True)
async def _resync_refresh_token_sequence():
    """The dev DB's refresh_tokens id sequence is behind MAX(id) (seed rows were
    inserted with explicit ids), so a real login insert collides. Resync it
    before these tests (idempotent; sequences are non-transactional). This also
    flags a real prod issue — see the deployment checklist."""
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('refresh_tokens', 'id'), "
                "GREATEST((SELECT COALESCE(MAX(id), 1) FROM refresh_tokens), 1))"
            )
        )
    await engine.dispose()
    yield


@pytest.fixture(autouse=True)
def _disable_auth_limiters(monkeypatch):
    # Rate limiters key on client IP and share state across tests; disable them
    # here so these auth tests are deterministic (limiter behavior is covered by
    # test_redis_resilience.py).
    async def _noop(*a, **k):
        return (0, 0, 0)

    for lim in (
        ratelimit.login_limiter,
        ratelimit.refresh_limiter,
        ratelimit.logout_limiter,
    ):
        monkeypatch.setattr(lim, "check", _noop)


async def _make_user(db, *, username, password, role=UserRole.ADMIN):
    user = User(
        kh_family_name="ស",
        kh_given_name="ស",
        en_family_name="S",
        en_given_name="S",
        email=f"{username}@test.local",
        username=username,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


def _uname():
    return f"user_{uuid.uuid4().hex[:10]}"


@pytest.mark.asyncio
async def test_login_success_sets_cookies(client, db_session):
    uname = _uname()
    await _make_user(db_session, username=uname, password="ValidPass123")

    r = await client.post(
        "/api/auth/login", json={"username": uname, "password": "ValidPass123"}
    )

    assert r.status_code == 200
    assert "access_token_expires_at" in r.json()
    set_cookies = " ".join(r.headers.get_list("set-cookie"))
    assert "access_token=" in set_cookies
    assert "refresh_token=" in set_cookies


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client, db_session):
    uname = _uname()
    await _make_user(db_session, username=uname, password="ValidPass123")

    r = await client.post(
        "/api/auth/login", json={"username": uname, "password": "WrongPass999"}
    )

    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_legacy_weak_password_account_can_log_in(client, db_session):
    """P1-4: strength is enforced at registration, NOT login. A pre-existing
    account whose stored password predates the policy must still authenticate."""
    uname = _uname()
    await _make_user(db_session, username=uname, password="weak")  # < policy

    r = await client.post(
        "/api/auth/login", json={"username": uname, "password": "weak"}
    )

    assert r.status_code == 200


@pytest.mark.asyncio
async def test_unknown_user_returns_same_response_as_wrong_password(client, db_session):
    """P1-5: no enumeration via response content — unknown user and known-user/
    wrong-password are indistinguishable."""
    uname = _uname()
    await _make_user(db_session, username=uname, password="ValidPass123")

    wrong = await client.post(
        "/api/auth/login", json={"username": uname, "password": "Nope12345"}
    )
    unknown = await client.post(
        "/api/auth/login",
        json={"username": "ghost_" + uuid.uuid4().hex[:6], "password": "Nope12345"},
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


@pytest.mark.asyncio
async def test_unknown_user_still_runs_bcrypt_verify(client, db_session, monkeypatch):
    """P1-5: a bcrypt verify runs even when the username doesn't exist, so the
    timing is the same as a real account (constant-time / no fast path)."""
    import src.services.auth_service as auth_mod

    calls = []
    real = auth_mod.verify_password

    def spy(pw, h):
        calls.append(h)
        return real(pw, h)

    monkeypatch.setattr(auth_mod, "verify_password", spy)

    r = await client.post(
        "/api/auth/login",
        json={"username": "nobody_" + uuid.uuid4().hex[:6], "password": "Whatever123"},
    )

    assert r.status_code == 401
    assert len(calls) == 1  # bcrypt executed once despite no such user


@pytest.mark.asyncio
async def test_account_locks_after_five_failures(client, db_session):
    uname = _uname()
    await _make_user(db_session, username=uname, password="ValidPass123")

    for _ in range(5):
        r = await client.post(
            "/api/auth/login", json={"username": uname, "password": "WrongPass999"}
        )
        assert r.status_code == 401

    # Now locked: even the correct password is rejected.
    r = await client.post(
        "/api/auth/login", json={"username": uname, "password": "ValidPass123"}
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"
