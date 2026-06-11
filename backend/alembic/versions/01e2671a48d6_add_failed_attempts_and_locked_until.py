"""add_failed_attempts_and_locked_until

Revision ID: 01e2671a48d6
Revises: 425f25068de6
Create Date: 2026-06-04 13:18:26.653283

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "01e2671a48d6"
down_revision: Union[str, Sequence[str], None] = "425f25068de6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "failed_attempts",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "locked_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_attempts")
