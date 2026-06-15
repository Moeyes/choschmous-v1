"""Create all tables from the SQLAlchemy models (idempotent).

Used to bootstrap a fresh database — notably in CI, where there is no migrated
database to test against. Importing ``main`` pulls in the full router tree, which
imports every model so they register on ``Base.metadata`` before ``create_all``.

NOT a substitute for Alembic migrations in production; this is the documented
``create_all`` bootstrap path for fresh environments only.
"""

import asyncio
import os
import sys

# Ensure the backend root (parent of scripts/) is importable when run as a file.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main  # noqa: E402,F401 — side effect: registers every model on Base.metadata
from core.database import Base, engine  # noqa: E402


async def _create() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Schema created (create_all).")


if __name__ == "__main__":
    asyncio.run(_create())
