"""phase 6b — by-sport review state on sports_event_org

Revision ID: a9b8c7d6e5f4
Revises: f7a8b9c0d1e2
Create Date: 2026-06-17

Adds the review FSM columns ``status`` / ``review_note`` / ``reviewed_at`` to
``sports_event_org`` so the by-sport submission gets the same admin
review/monitoring treatment that ``participation_per_sport`` (by-number) and
``category_survey_review`` (by-category) already carry. The
``sports_event_org`` model declares these columns, but no migration ever added
them, so the by-sport review path (``events_service`` filters on
``sports_event_org.status``) 500s against the real DB.

These mirror EXACTLY the ``participation_per_sport`` review columns:
``status`` is a plain ``String(32)`` NOT NULL defaulting to ``'SUBMITTED'``
(NOT a postgres enum — so there is no shared enum type to (re)create or drop
here), ``review_note`` is a nullable ``String``, ``reviewed_at`` is a nullable
``DateTime``. Additive only.

NOTE (length drift, intentional): the ``sports_event_org`` model currently
declares ``status`` as ``String(20)`` whereas ``participation_per_sport`` and
``category_survey_review`` use ``String(32)``. This migration uses ``String(32)``
as instructed (mirror the canonical review columns exactly). The model's
``String(20)`` should be reconciled to ``String(32)`` separately; it is harmless
in practice because every status token ('DRAFT', 'SUBMITTED', 'APPROVED',
'REJECTED', 'FLAGGED', 'REVISION_REQUESTED') fits within 20 chars.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE = "sports_event_org"


def _existing_columns() -> set[str]:
    """Return the set of column names currently present on ``sports_event_org``.

    Some DBs already had ``status`` / ``review_note`` / ``reviewed_at`` added
    out-of-band, so a plain ``op.add_column`` raises DuplicateColumnError there.
    Inspecting the live bind lets ``upgrade()``/``downgrade()`` act only on the
    delta and stay idempotent across both fresh and drifted databases.
    """
    conn = op.get_bind()
    return {col["name"] for col in sa.inspect(conn).get_columns(TABLE)}


def upgrade() -> None:
    existing = _existing_columns()

    # status: NOT NULL with a server_default so existing rows backfill to
    # 'SUBMITTED' (additive, safe on a populated table). Mirrors
    # participation_per_sport.status exactly.
    if "status" not in existing:
        op.add_column(
            TABLE,
            sa.Column(
                "status",
                sa.String(length=32),
                nullable=False,
                server_default="SUBMITTED",
            ),
        )
    if "review_note" not in existing:
        op.add_column(
            TABLE,
            sa.Column("review_note", sa.String(), nullable=True),
        )
    if "reviewed_at" not in existing:
        op.add_column(
            TABLE,
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    existing = _existing_columns()

    if "reviewed_at" in existing:
        op.drop_column(TABLE, "reviewed_at")
    if "review_note" in existing:
        op.drop_column(TABLE, "review_note")
    if "status" in existing:
        op.drop_column(TABLE, "status")
