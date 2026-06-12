"""phase 4 — organizer_roles lookup + organizer_participation

Revision ID: d5e6f7g8h9i0
Revises: c4d5e6f7g8h9
Create Date: 2026-06-12

Creates the ``organizer_roles`` lookup table with seeded roles and the
``organizer_participation`` join table linking an Enroll record to an event
and a role. Organizer registrations are event-level only (no sport/category).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7g8h9i0"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7g8h9"

def upgrade() -> None:
    op.create_table(
        "organizer_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name_kh", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "organizer_participation",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("enroll_id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("organizer_role_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["enroll_id"], ["enrollments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organizer_role_id"], ["organizer_roles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizer_participation_enroll_id", "organizer_participation", ["enroll_id"])
    op.create_index("ix_organizer_participation_event_id", "organizer_participation", ["event_id"])

    op.execute(
        """
        INSERT INTO organizer_roles (name_kh, name_en) VALUES
            ('ប្រធានគណៈប្រតិភូ', 'Head of Delegation'),
            ('អនុប្រធានគណៈប្រតិភូ', 'Deputy Head of Delegation'),
            ('សមាជិក', 'Member'),
            ('មេដឹកនាំក្រុម', 'Team Leader'),
            ('មន្ត្រីបច្ចេកទេស', 'Technical Official'),
            ('អាជ្ញាកណ្តាល', 'Referee'),
            ('ពេទ្យ', 'Medical'),
            ('សន្តិសុខ', 'Security'),
            ('ប្រព័ន្ធផ្សព្វផ្សាយ', 'Media'),
            ('អ្នកស្ម័គ្រចិត្ត', 'Volunteer')
        """
    )


def downgrade() -> None:
    op.drop_table("organizer_participation")
    op.drop_table("organizer_roles")
