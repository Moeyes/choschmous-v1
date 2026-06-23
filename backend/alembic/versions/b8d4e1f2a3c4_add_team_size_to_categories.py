"""add_team_size_to_categories

Revision ID: b8d4e1f2a3c4
Revises: fe93a4dc40ad
Create Date: 2026-06-23 00:00:00.000000

Add nullable ``team_size_min`` / ``team_size_max`` integer columns to the
``categories`` table so an admin can mark a category as a team category
(max size > 1, e.g. Doubles = 2). Both are nullable; an absent max means an
individual category. No data backfill is required.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b8d4e1f2a3c4"
down_revision: Union[str, Sequence[str], None] = "fe93a4dc40ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the nullable team_size_min / team_size_max columns to categories."""
    op.add_column(
        "categories", sa.Column("team_size_min", sa.Integer(), nullable=True)
    )
    op.add_column(
        "categories", sa.Column("team_size_max", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    """Remove the team size columns from categories."""
    op.drop_column("categories", "team_size_max")
    op.drop_column("categories", "team_size_min")
