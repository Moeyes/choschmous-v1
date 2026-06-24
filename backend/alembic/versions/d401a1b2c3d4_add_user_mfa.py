"""CHOS-401: add user_mfa (TOTP/WebAuthn enrolment + recovery codes)

Revision ID: d401a1b2c3d4
Revises: c305a1b2c3d4
Create Date: 2026-06-24

Adds the ``user_mfa`` table that backs multi-factor authentication for
privileged accounts. One row per enrolled user; the credential material lives
here rather than on ``users`` so its access surface is tighter and an un-enrolled
user simply has no row.

Idempotent / delta-only, following the project's reconcile pattern (the CI/test
schema is built by ``create_all`` from the models and this migration is then
``stamp``-ed, never run there): the step inspects the live bind and only creates
the table when it is missing, so it is safe on a fresh ``create_all`` DB and on a
real DB sitting at the previous head.

TODO(CHOS-403): once the field-level encryption type lands, migrate
``totp_secret`` to the encrypted column type (the value is shared-secret key
material and should be encrypted at rest).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d401a1b2c3d4"
down_revision = "c305a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "user_mfa" in insp.get_table_names():
        return  # already present (e.g. create_all-built test/CI schema)

    op.create_table(
        "user_mfa",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("totp_secret", sa.String(length=64), nullable=True),
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "recovery_codes",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "webauthn_credentials",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "user_mfa" in insp.get_table_names():
        op.drop_table("user_mfa")
