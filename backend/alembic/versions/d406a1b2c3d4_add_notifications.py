"""CHOS-406: add notifications (in-app inbox)

Revision ID: d406a1b2c3d4
Revises: d403a1b2c3d4
Create Date: 2026-06-25

Adds the ``notifications`` table backing the in-app notification inbox. One row
per notification delivered to a user (registration confirmation, review outcome,
bulk-import result…). The only mutation after insert is stamping ``read_at``.

Idempotent / delta-only, following the project's reconcile pattern (the CI/test
schema is built by ``create_all`` from the models and this migration is then
``stamp``-ed, never run there): the step inspects the live bind and only creates
the table/indexes when missing, so it is safe on a fresh ``create_all`` DB and on
a real DB sitting at the previous head.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d406a1b2c3d4"
down_revision = "d403a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "notifications" in insp.get_table_names():
        return  # already present (e.g. create_all-built test/CI schema)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "char_length(btrim(title)) > 0", name="ck_notifications_title_nonempty"
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index(
        "ix_notifications_user_created",
        "notifications",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "read_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "notifications" not in insp.get_table_names():
        return
    for ix in (
        "ix_notifications_user_unread",
        "ix_notifications_user_created",
        "ix_notifications_created_at",
        "ix_notifications_user_id",
    ):
        op.drop_index(ix, table_name="notifications")
    op.drop_table("notifications")
