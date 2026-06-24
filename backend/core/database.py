import os
from urllib.parse import quote

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Async connection string — quote user/pass so special characters (@, !, :, etc.)
# don't break the URI parser.
DATABASE_URL = f"postgresql+asyncpg://{quote(DB_USER)}:{quote(DB_PASS)}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def _build_read_url() -> tuple[str, bool]:
    """Resolve the read-replica connection URL (CHOS-301).

    Precedence:
      1. ``DATABASE_READ_URL`` — a complete async URL pointing at the read path
         (in prod this is the **PgBouncer** service that fronts the replicas with
         transaction pooling; PgBouncer in turn load-balances across the 2 read
         replicas — see infra/terraform/database.tf).
      2. ``DB_READ_HOST`` (+ optional ``DB_READ_PORT``, defaulting to ``DB_PORT``)
         — same credentials/db as the primary, different host.
      3. Fall back to the primary ``DATABASE_URL`` — single-DB dev / CI / test, so
         behaviour is identical to before the split.

    Returns ``(url, is_distinct_replica)`` where the bool is False when we fell
    back to the primary (so callers can avoid spinning up a redundant pool).
    """
    explicit = os.getenv("DATABASE_READ_URL")
    if explicit:
        return explicit, True

    read_host = os.getenv("DB_READ_HOST")
    if read_host:
        read_port = os.getenv("DB_READ_PORT", DB_PORT)
        return (
            f"postgresql+asyncpg://{quote(DB_USER)}:{quote(DB_PASS)}"
            f"@{read_host}:{read_port}/{DB_NAME}",
            True,
        )

    return DATABASE_URL, False


READ_DATABASE_URL, _READ_REPLICA_CONFIGURED = _build_read_url()

# Async engine/session configuration — PRIMARY (writes + read-after-write).
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
    connect_args={
        "statement_cache_size": 256,
        "command_timeout": 30,
    },
)
Base = declarative_base()
SessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)

# Read path (CHOS-301): dashboards, reports and list/search reads go here so the
# heavy read-only / analytical traffic is served by the replicas and never
# competes with writes on the primary.
#
# When no distinct replica is configured (dev / CI / test) we *reuse* the primary
# engine + session factory rather than open a second pool to the same database —
# so a single-DB setup behaves exactly as before.
if _READ_REPLICA_CONFIGURED:
    read_engine = create_async_engine(
        READ_DATABASE_URL,
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_timeout=30,
        connect_args={
            # PgBouncer in *transaction* pooling mode does not support server-side
            # prepared statements, so asyncpg's statement cache MUST be disabled on
            # the read path or it will error ("prepared statement already exists").
            # TODO(infra): point DATABASE_READ_URL / DB_READ_HOST at the PgBouncer
            # service (infra/terraform/database.tf) and require the injected
            # read credentials (no default host).
            "statement_cache_size": 0,
            "command_timeout": 30,
        },
    )
    ReadSessionLocal = async_sessionmaker(
        bind=read_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
else:
    read_engine = engine
    ReadSessionLocal = SessionLocal
