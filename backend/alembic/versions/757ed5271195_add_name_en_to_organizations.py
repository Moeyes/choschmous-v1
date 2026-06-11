"""add_name_en_to_organizations

Revision ID: 757ed5271195
Revises: b2c3d4e5f6a7
Create Date: 2026-06-10 13:46:09.494249

Scoped to the single change that fixes the 500 on GET /api/organization:
add the nullable `organizations.name_en` column that the SQLAlchemy model
already declares but the table is missing.

NOTE: `alembic revision --autogenerate` also reported a large amount of
unrelated drift (dropping the gin_trgm/composite indexes created by earlier
raw-SQL migrations, an organizations.code type/NOT NULL change, users.role
enum schema-qualification, and uploaded_files column comments). Those were
deliberately removed from this migration — applying them would drop the
search/performance indexes and risk failing on existing data. They are
tracked separately and out of scope for this bug fix.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '757ed5271195'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the nullable name_en column to organizations."""
    op.add_column(
        'organizations',
        sa.Column('name_en', sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Remove the name_en column from organizations."""
    op.drop_column('organizations', 'name_en')
