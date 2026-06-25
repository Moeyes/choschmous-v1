"""CHOS-501: add minor_consents (guardian consent for a minor's PII)

Revision ID: d501a1b2c3d4
Revises: d406a1b2c3d4
Create Date: 2026-06-25

Adds the ``minor_consents`` table recording the lawful basis for processing an
under-18 participant's PII: the consenting guardian, their relationship, the
policy version agreed to, and when. One row per enrollment (unique enroll_id);
``ondelete=CASCADE`` so erasing the enrollment removes the consent record.

Idempotent / delta-only, following the project's reconcile pattern (the CI/test
schema is built by ``create_all`` from the models and this migration is then
``stamp``-ed, never run there): inspect the live bind and only create the
table/indexes when missing, so it is safe on a fresh ``create_all`` DB and on a
real DB sitting at the previous head.
"""

from alembic import op
import sqlalchemy as sa

revision = "d501a1b2c3d4"
down_revision = "d406a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "minor_consents" in insp.get_table_names():
        return  # already present (e.g. create_all-built test/CI schema)

    op.create_table(
        "minor_consents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "enroll_id",
            sa.Integer(),
            sa.ForeignKey("enrollments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("guardian_name", sa.String(length=200), nullable=False),
        sa.Column("guardian_relationship", sa.String(length=50), nullable=False),
        # Restricted-PII, envelope-encrypted at rest (CHOS-403): the column holds
        # ciphertext, so it is widened to 255 like enrollments.phonenumber.
        sa.Column("guardian_phone", sa.String(length=255), nullable=True),
        sa.Column("consent_version", sa.String(length=32), nullable=False),
        sa.Column(
            "consented_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "char_length(btrim(guardian_name)) > 0",
            name="ck_minor_consent_guardian_name_nonempty",
        ),
    )
    op.create_index(
        "ix_minor_consents_enroll_id", "minor_consents", ["enroll_id"], unique=True
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "minor_consents" not in insp.get_table_names():
        return
    op.drop_index("ix_minor_consents_enroll_id", table_name="minor_consents")
    op.drop_table("minor_consents")
