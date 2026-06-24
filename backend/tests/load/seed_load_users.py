"""CHOS-306: seed N load-test accounts for the Locust scenarios.

Creates ``loaduser1..N`` (idempotent) sharing one password, so the load test can
drive many DISTINCT users and stay under the per-user rate limits while still
generating high aggregate RPS. Used by the CI smoke step and before a real run.

    LOAD_TEST_USER_COUNT=500 LOAD_TEST_PASSWORD=... \
        uv run python tests/load/seed_load_users.py

Accounts are SUPER_ADMIN so the read scenarios (dashboard/events) and the
register scenario work without per-org wiring. These are throwaway accounts for
NON-production load environments only — never seed them against prod.
"""

import asyncio
import os
import sys

# Ensure the backend root (two levels up from tests/load/) is importable when
# this is run as a file: `uv run python tests/load/seed_load_users.py`.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select  # noqa: E402

from core.database import SessionLocal  # noqa: E402
from core.security import hash_password
from src.models.enum.user import UserRole
from src.models.user import User

# Import related models so SQLAlchemy can resolve User relationships.
from src.models.organization import Organization  # noqa: F401
from src.models.refresh_token import RefreshToken  # noqa: F401
from src.models.sport import Sport  # noqa: F401

COUNT = int(os.getenv("LOAD_TEST_USER_COUNT", "5"))
PASSWORD = os.getenv("LOAD_TEST_PASSWORD", "LoadTest!2026Pass")
PREFIX = os.getenv("LOAD_TEST_USER_PREFIX", "loaduser")


async def main() -> None:
    created = 0
    async with SessionLocal() as session:
        for i in range(1, COUNT + 1):
            username = f"{PREFIX}{i}"
            email = f"{username}@load.local"
            existing = (
                await session.execute(
                    select(User).where(
                        (User.username == username) | (User.email == email)
                    )
                )
            ).scalars().first()
            if existing:
                existing.hashed_password = hash_password(PASSWORD)
                existing.is_active = True
                continue
            session.add(
                User(
                    username=username,
                    email=email,
                    hashed_password=hash_password(PASSWORD),
                    kh_family_name="បន្ទុក",
                    kh_given_name=str(i),
                    en_family_name="LOAD",
                    en_given_name=str(i),
                    role=UserRole.SUPER_ADMIN,
                    is_superuser=True,
                    is_active=True,
                    organization_id=None,
                )
            )
            created += 1
        await session.commit()
    print(f"Seeded load users: {COUNT} total ({created} new) prefix={PREFIX!r}")


if __name__ == "__main__":
    asyncio.run(main())
