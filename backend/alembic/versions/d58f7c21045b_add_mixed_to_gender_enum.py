"""add_mixed_to_gender_enum

Revision ID: d58f7c21045b
Revises: 757ed5271195
Create Date: 2026-06-11 14:19:24.642935

Add 'MIXED' to the ``genderenum`` Postgres enum so that the category-survey
flow can store mixed-gender categories alongside MALE / FEMALE.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d58f7c21045b"
down_revision: Union[str, Sequence[str], None] = "757ed5271195"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE genderenum ADD VALUE 'MIXED'")


def downgrade() -> None:
    # There is no safe way to remove a value from a Postgres enum without
    # recreating the type and all dependent columns. In production this
    # downgrade is a no-op; for local dev you may drop and recreate the DB.
    pass
