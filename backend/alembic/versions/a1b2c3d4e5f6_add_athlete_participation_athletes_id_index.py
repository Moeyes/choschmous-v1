"""add athlete_participation.athletes_id index

Perf fix #1 (PERF_REPORT.md §5): every participant read path joins
athlete_participation -> athletes on athletes_id, which had no index, forcing a
full Seq Scan on athlete_participation (incl. the per-request IDOR owner check).
This adds the missing FK index so those joins become index lookups.

Additive, reversible, and guarded (IF NOT EXISTS / IF EXISTS) so it is safe to
apply and roll back repeatedly. Index name matches the SQLAlchemy default for the
model's ``index=True`` so autogenerate stays in sync.

Revision ID: a1b2c3d4e5f6
Revises: 834864ee56c1
Create Date: 2026-06-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "834864ee56c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_athlete_participation_athletes_id "
            "ON athlete_participation (athletes_id)"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("DROP INDEX IF EXISTS ix_athlete_participation_athletes_id")
    )
