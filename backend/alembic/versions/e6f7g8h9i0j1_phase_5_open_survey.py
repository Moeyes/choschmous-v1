"""phase 5 — open-survey fields/responses + events.survey_open phase

Revision ID: e6f7g8h9i0j1
Revises: d5e6f7g8h9i0
Create Date: 2026-06-13

Creates the ``open_survey_fields`` and ``open_survey_responses`` tables (a
free-form, per-event survey defined as fields and answered per organization)
and adds the ``survey_open`` lifecycle phase columns to ``events``.

The ``survey_open`` phase reuses the EXISTING ``phase_status`` postgres enum
shared by the other phases — it is referenced with ``create_type=False`` so the
type is not (re)created.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e6f7g8h9i0j1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7g8h9i0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Reuse the pre-existing shared enum type; do NOT create it again.
phase_status_enum = postgresql.ENUM(
    "AUTO", "OPEN", "CLOSED", name="phase_status", create_type=False
)


def upgrade() -> None:
    op.create_table(
        "open_survey_fields",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("label_kh", sa.String(length=255), nullable=False),
        sa.Column("label_en", sa.String(length=255), nullable=True),
        sa.Column(
            "field_type", sa.String(length=50), nullable=False, server_default="text"
        ),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column(
            "required", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_open_survey_fields_event_id"),
        "open_survey_fields",
        ["event_id"],
    )

    op.create_table(
        "open_survey_responses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("field_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["field_id"], ["open_survey_fields.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_open_survey_responses_field_id"),
        "open_survey_responses",
        ["field_id"],
    )
    op.create_index(
        op.f("ix_open_survey_responses_organization_id"),
        "open_survey_responses",
        ["organization_id"],
    )

    op.add_column(
        "events",
        sa.Column(
            "survey_open_status",
            phase_status_enum,
            nullable=False,
            server_default="AUTO",
        ),
    )
    op.add_column(
        "events", sa.Column("survey_open_open_date", sa.Date(), nullable=True)
    )
    op.add_column(
        "events", sa.Column("survey_open_close_date", sa.Date(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("events", "survey_open_close_date")
    op.drop_column("events", "survey_open_open_date")
    op.drop_column("events", "survey_open_status")

    op.drop_index(
        op.f("ix_open_survey_responses_organization_id"),
        table_name="open_survey_responses",
    )
    op.drop_index(
        op.f("ix_open_survey_responses_field_id"),
        table_name="open_survey_responses",
    )
    op.drop_table("open_survey_responses")

    op.drop_index(
        op.f("ix_open_survey_fields_event_id"),
        table_name="open_survey_fields",
    )
    op.drop_table("open_survey_fields")
    # NB: the shared ``phase_status`` enum type is intentionally NOT dropped.
