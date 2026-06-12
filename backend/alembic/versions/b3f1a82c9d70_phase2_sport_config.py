"""phase2 sport-event config + event participant cap

Revision ID: b3f1a82c9d70
Revises: d58f7c21045b
Create Date: 2026-06-12

Adds per-sport competition config to ``sports_event`` (mode / team size / quotas)
and an optional event-wide ``participant_cap`` to ``events``.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b3f1a82c9d70"
down_revision: Union[str, Sequence[str], None] = "d58f7c21045b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_type=False — the type is created idempotently below, not by add_column.
sport_mode_enum = postgresql.ENUM(
    "individual", "team", "both", name="sport_mode", create_type=False
)


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sport_mode') THEN "
        "CREATE TYPE sport_mode AS ENUM ('individual', 'team', 'both'); "
        "END IF; END $$;"
    )
    op.add_column(
        "sports_event",
        sa.Column(
            "mode", sport_mode_enum, nullable=False, server_default="individual"
        ),
    )
    op.add_column(
        "sports_event", sa.Column("team_size_min", sa.Integer(), nullable=True)
    )
    op.add_column(
        "sports_event", sa.Column("team_size_max", sa.Integer(), nullable=True)
    )
    op.add_column(
        "sports_event",
        sa.Column("quota_athletes_per_org", sa.Integer(), nullable=True),
    )
    op.add_column(
        "sports_event", sa.Column("quota_teams_per_org", sa.Integer(), nullable=True)
    )
    op.add_column("events", sa.Column("participant_cap", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "participant_cap")
    op.drop_column("sports_event", "quota_teams_per_org")
    op.drop_column("sports_event", "quota_athletes_per_org")
    op.drop_column("sports_event", "team_size_max")
    op.drop_column("sports_event", "team_size_min")
    op.drop_column("sports_event", "mode")
    op.execute("DROP TYPE IF EXISTS sport_mode")
