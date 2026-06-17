"""reconcile out-of-band schema patches into alembic

Revision ID: c8d9e0f1a2b3
Revises: a9b8c7d6e5f4
Create Date: 2026-06-17

Folds THREE schema objects that today exist in real databases only because of
the raw-DDL "ensure" helpers in ``src/api/v1/routes/maintenance.py`` (the
``POST /sync-schema`` endpoint) — never via any migration — into Alembic, so
``alembic_version`` stops drifting from the real schema. The three patches and
the verbatim DDL each ensure-helper applies:

1. ``sports.sport_type`` (``_ensure_sport_type_column``)::

       ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type VARCHAR(100)

   => ``String(100)``, nullable, no default. Matches the ``Sport`` model
   (``sport_type: Mapped[str] = mapped_column(String(100), nullable=True)``).

2. ``uq_sports_event_org_keys`` partial unique index
   (``_ensure_org_sports_unique_index``)::

       CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_event_org_keys
       ON sports_event_org (events_id, sports_id, organization_id)
       WHERE events_id IS NOT NULL
         AND sports_id IS NOT NULL
         AND organization_id IS NOT NULL

3. ``participation_per_sport`` review FSM columns
   (``_ensure_participation_review_columns``)::

       ALTER TABLE participation_per_sport
         ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED'
       ALTER TABLE participation_per_sport
         ADD COLUMN IF NOT EXISTS review_note TEXT
       ALTER TABLE participation_per_sport
         ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP

   => ``status`` ``String(32)`` NOT NULL ``server_default='SUBMITTED'``;
   ``review_note`` nullable ``String`` (unbounded => TEXT); ``reviewed_at``
   nullable ``DateTime``. Matches the ``participation_per_sport`` model.

Idempotent, additive, no enum — follows the proven ``a9b8c7d6e5f4`` template:
inspect the live bind and act ONLY on the delta. It must succeed both on a DB
that already has all three (e.g. one ``sync-schema`` already patched, or a
fresh DB built by ``create_all``) AND on one that has none. ``upgrade()`` adds
only what is missing; ``downgrade()`` drops only what exists, in reverse order.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_sports_event_org_keys"
INDEX_TABLE = "sports_event_org"
# Verbatim predicate from _ensure_org_sports_unique_index in maintenance.py.
INDEX_WHERE = (
    "events_id IS NOT NULL "
    "AND sports_id IS NOT NULL "
    "AND organization_id IS NOT NULL"
)


def _columns(table: str) -> set[str]:
    """Column names currently present on ``table`` per the live bind.

    Some DBs already had these objects added out-of-band by ``sync-schema`` (or
    built by ``create_all``), so a plain ``op.add_column`` would raise
    DuplicateColumnError there. Inspecting the bind lets up/down act only on the
    delta and stay idempotent across fresh and drifted databases.
    """
    conn = op.get_bind()
    return {col["name"] for col in sa.inspect(conn).get_columns(table)}


def _indexes(table: str) -> set[str]:
    """Index names currently present on ``table`` per the live bind."""
    conn = op.get_bind()
    return {ix["name"] for ix in sa.inspect(conn).get_indexes(table)}


def upgrade() -> None:
    # 1. sports.sport_type — String(100), nullable, no default.
    if "sport_type" not in _columns("sports"):
        op.add_column(
            "sports",
            sa.Column("sport_type", sa.String(length=100), nullable=True),
        )

    # 2. uq_sports_event_org_keys — partial UNIQUE index mirroring the helper's
    #    exact columns + WHERE predicate.
    if INDEX_NAME not in _indexes(INDEX_TABLE):
        op.create_index(
            INDEX_NAME,
            INDEX_TABLE,
            ["events_id", "sports_id", "organization_id"],
            unique=True,
            postgresql_where=sa.text(INDEX_WHERE),
        )

    # 3. participation_per_sport review FSM columns. status: NOT NULL with a
    #    server_default so existing rows backfill to 'SUBMITTED' (safe on a
    #    populated table); note/timestamp are nullable.
    ppos = _columns("participation_per_sport")
    if "status" not in ppos:
        op.add_column(
            "participation_per_sport",
            sa.Column(
                "status",
                sa.String(length=32),
                nullable=False,
                server_default="SUBMITTED",
            ),
        )
    if "review_note" not in ppos:
        op.add_column(
            "participation_per_sport",
            sa.Column("review_note", sa.String(), nullable=True),
        )
    if "reviewed_at" not in ppos:
        op.add_column(
            "participation_per_sport",
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    # Reverse order: participation columns, then the index, then sport_type.
    ppos = _columns("participation_per_sport")
    if "reviewed_at" in ppos:
        op.drop_column("participation_per_sport", "reviewed_at")
    if "review_note" in ppos:
        op.drop_column("participation_per_sport", "review_note")
    if "status" in ppos:
        op.drop_column("participation_per_sport", "status")

    if INDEX_NAME in _indexes(INDEX_TABLE):
        op.drop_index(INDEX_NAME, table_name=INDEX_TABLE)

    if "sport_type" in _columns("sports"):
        op.drop_column("sports", "sport_type")
