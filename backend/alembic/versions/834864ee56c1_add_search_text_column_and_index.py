"""add_search_text_column_and_index

Revision ID: 834864ee56c1
Revises: 01e2671a48d6
Create Date: 2026-06-04 13:28:10.882193

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "834864ee56c1"
down_revision: Union[str, Sequence[str], None] = "01e2671a48d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollments",
        sa.Column(
            "search_text",
            sa.String(605),
            sa.Computed(
                "COALESCE(kh_family_name, '') || ' ' || COALESCE(kh_given_name, '') || ' ' || "
                "COALESCE(en_family_name, '') || ' ' || COALESCE(en_given_name, '') || ' ' || "
                "COALESCE(phonenumber, '')"
            ),
            nullable=True,
        ),
    )
    op.create_index(
        "idx_enrollments_search_text_trgm",
        "enrollments",
        ["search_text"],
        postgresql_using="gin",
        postgresql_ops={"search_text": "gin_trgm_ops"},
    )

    # Disable fastupdate on existing GIN indexes for consistent query perf
    # after bulk inserts (pending list causes spiky latency).
    for idx in [
        "idx_enrollments_phonenumber_trgm",
        "idx_enrollments_kh_name",
        "idx_enrollments_en_name",
    ]:
        op.execute(sa.text(f"ALTER INDEX {idx} SET (fastupdate = off)"))


def downgrade() -> None:
    op.drop_index("idx_enrollments_search_text_trgm", table_name="enrollments")
    op.drop_column("enrollments", "search_text")

    for idx in [
        "idx_enrollments_phonenumber_trgm",
        "idx_enrollments_kh_name",
        "idx_enrollments_en_name",
    ]:
        op.execute(sa.text(f"ALTER INDEX {idx} RESET (fastupdate)"))
