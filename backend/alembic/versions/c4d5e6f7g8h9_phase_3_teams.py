"""phase 3 — teams table + athlete_participation.team_id

Revision ID: c4d5e6f7g8h9
Revises: b3f1a82c9d70
Create Date: 2026-06-12

Creates the ``teams`` table and adds a ``team_id`` FK on
``athlete_participation`` so athletes can be grouped into teams.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7g8h9"
down_revision: Union[str, Sequence[str], None] = "b3f1a82c9d70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("sport_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["sport_id"], ["sports.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["org_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_teams_id"), "teams", ["id"])
    op.create_index(op.f("ix_teams_event_id"), "teams", ["event_id"])

    op.add_column(
        "athlete_participation",
        sa.Column("team_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_athlete_participation_team_id"),
        "athlete_participation",
        ["team_id"],
    )
    op.create_foreign_key(
        "fk_athlete_participation_team_id",
        "athlete_participation",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_athlete_participation_team_id",
        "athlete_participation",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_athlete_participation_team_id"),
        table_name="athlete_participation",
    )
    op.drop_column("athlete_participation", "team_id")
    op.drop_index(op.f("ix_teams_event_id"), table_name="teams")
    op.drop_index(op.f("ix_teams_id"), table_name="teams")
    op.drop_table("teams")
