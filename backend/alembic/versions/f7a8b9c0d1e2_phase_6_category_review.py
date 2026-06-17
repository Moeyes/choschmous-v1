"""phase 6 — by-category review state (category_survey_review)

Revision ID: f7a8b9c0d1e2
Revises: e6f7g8h9i0j1
Create Date: 2026-06-16

Adds the ``category_survey_review`` table: a thin review-state header for a
by-category submission, keyed by ``(events_id, sports_id)``. It mirrors the
review FSM columns already carried by ``participation_per_sport`` (by-number) so
the by-category survey gets the same admin review/monitoring treatment, WITHOUT
flattening the categories: the ``categories`` rows are left untouched and stay
the submission's data — this header only holds ``status``/``review_note``/
``reviewed_at`` for the (event, sport) pair.

``status`` is a plain ``String(32)`` (identical to
``participation_per_sport.status``), NOT a postgres enum — so there is no shared
enum type to (re)create or drop here.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7g8h9i0j1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category_survey_review",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("events_id", sa.Integer(), nullable=True),
        sa.Column("sports_id", sa.Integer(), nullable=True),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="SUBMITTED"
        ),
        sa.Column("review_note", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["events_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sports_id"], ["sports.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "events_id", "sports_id", name="uix_category_review_event_sport"
        ),
    )
    op.create_index(
        op.f("ix_category_survey_review_events_id"),
        "category_survey_review",
        ["events_id"],
    )
    op.create_index(
        op.f("ix_category_survey_review_sports_id"),
        "category_survey_review",
        ["sports_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_category_survey_review_sports_id"),
        table_name="category_survey_review",
    )
    op.drop_index(
        op.f("ix_category_survey_review_events_id"),
        table_name="category_survey_review",
    )
    op.drop_table("category_survey_review")
