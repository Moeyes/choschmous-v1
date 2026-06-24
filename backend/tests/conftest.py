"""Shared pytest fixtures for the backend test suite.

Two building blocks:

* ``db_session`` — an ``AsyncSession`` joined to an outer transaction that is
  always rolled back at teardown. Because the app's services call
  ``session.commit()``, each commit only releases and re-opens a SAVEPOINT
  (the outer transaction is never committed), so every test is fully isolated
  yet exercises the real commit path. This is the canonical SQLAlchemy async
  "join a session into an external transaction" recipe.

* ``client`` — an ``httpx.AsyncClient`` bound to the real ASGI ``app`` with
  ``get_db`` overridden to the test session and a matching CSRF
  header/cookie pair so the double-submit CSRF middleware lets mutating
  requests through.

Auth is injected per-test by overriding ``get_current_user`` via the
``as_user`` fixture — tests build in-memory ``User`` objects (never persisted)
with whatever role / sport / org they need, so no JWT minting is required.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from core.database import DATABASE_URL
from main import app
from src.database.deps import get_current_user, get_db, get_read_db
from src.models.enum.user import UserRole
from src.models.user import User

# A single value used for both the CSRF cookie and header so the double-submit
# check (`secrets.compare_digest`) passes for mutating test requests.
_CSRF_TOKEN = "test-csrf-token"


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def test_engine():
    # A dedicated engine with NullPool so connections are never reused across
    # event loops — avoids asyncpg's "attached to a different loop" errors and
    # keeps the test suite off the app's production connection pool.
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(test_engine) -> AsyncSession:
    # An outer transaction that is always rolled back. ``join_transaction_mode=
    # "create_savepoint"`` makes the app's own session.commit()/rollback() act on
    # SAVEPOINTs inside this outer transaction, so each test is isolated even
    # across multiple commits/rollbacks — without the fragile after-commit event
    # hook (which broke with asyncpg under repeated commits).
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            autoflush=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
        # exiting `async with engine.connect()` rolls the outer transaction back


@pytest_asyncio.fixture(loop_scope="session")
async def client(db_session: AsyncSession) -> AsyncClient:
    async def _get_db_override():
        yield db_session

    # Route BOTH the primary and the read-replica dependency to the single test
    # session so the read/write split (CHOS-301) stays inside the test's rolled-
    # back transaction and read handlers still see the test's uncommitted data.
    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_read_db] = _get_db_override
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"X-CSRF-Token": _CSRF_TOKEN},
        cookies={"csrf_token": _CSRF_TOKEN},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _disable_rate_limits(monkeypatch):
    """Neutralize all rate limiters in tests — they are Redis-backed and shared
    across tests, so real limits would cause flaky cross-test 429s."""

    async def _noop(self, *args, **kwargs):
        return None

    monkeypatch.setattr("core.ratelimit.RateLimiter.check", _noop, raising=True)


@pytest.fixture
def as_user():
    """Return a setter that pins ``get_current_user`` to a given ``User``."""

    def _set(user: User) -> None:
        app.dependency_overrides[get_current_user] = lambda: user

    return _set


def make_user(
    role: UserRole,
    *,
    sport_id: int | None = None,
    organization_id: int | None = None,
) -> User:
    """Build an in-memory (never persisted) user for dependency injection."""
    return User(
        role=role,
        sport_id=sport_id,
        organization_id=organization_id,
        email=f"{role.value}@test.local",
        username=f"{role.value}_test",
    )
