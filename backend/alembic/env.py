import asyncio
import os
from logging.config import fileConfig
from urllib.parse import quote

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from core.database import Base
from src.models import *  # noqa: F401,F403 — import all models so autogenerate can see them

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from environment (Alembic runs standalone, not via the app)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
# Quote user/pass so an injected secret with special characters (@, !, :, etc.)
# — e.g. a Vault-minted DB password (CHOS-201) — can't break the URI parser.
# Mirrors core/database.py; without this the migration gate fails on such creds.
DB_URL = (
    f"postgresql+asyncpg://{quote(os.getenv('DB_USER', ''))}:{quote(os.getenv('DB_PASS', ''))}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
# Escape '%' as '%%' so a percent-encoded credential isn't mangled by
# ConfigParser's interpolation (no-op for simple passwords like CI's).
config.set_main_option("sqlalchemy.url", DB_URL.replace("%", "%%"))


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
