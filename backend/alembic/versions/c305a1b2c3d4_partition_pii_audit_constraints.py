"""CHOS-305: monthly-partition pii_access_logs, add audit_log, FK + UNIQUE + CHECKs

Revision ID: c305a1b2c3d4
Revises: b8d4e1f2a3c4
Create Date: 2026-06-24

What this migration does (on a real, migration-driven database):
  1. Converts ``pii_access_logs`` to a RANGE-partitioned table by ``created_at``
     (monthly partitions + a DEFAULT catch-all), preserving its rows. A
     partitioned table's PK must include the partition key, so the PK becomes
     ``(id, created_at)`` (nothing references this audit table's id, so this is
     safe). The ``target_enroll_id`` FK to ``enrollments`` (SET NULL) is added
     here and the column becomes nullable so the audit row outlives the
     enrollment.
  2. Creates the ``audit_log`` table.
  3. Adds the enrollment natural-key UNIQUE on ``athlete_participation``
     (athletes_id, events_id, sports_id, category_id).
  4. Adds CHECK constraints to ``enrollments`` (DOB range, non-empty phone).

Idempotent / delta-only, following the project's established reconcile pattern
(see c8d9e0f1a2b3): the CI/test schema is built by ``create_all`` from the models
and this migration is then ``stamp``ed (never run there), so each step inspects
the live bind and only acts on what is missing. This makes it safe both on a
fresh ``create_all`` DB and on a real DB sitting at the previous head.

NOTE (partition maintenance): new monthly partitions must be pre-created by a
scheduled job (e.g. pg_partman or a periodic arq task). The DEFAULT partition is
the safety net so an insert never fails if a month's partition is missing.
TODO(infra): wire that partition-roll job.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c305a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "b8d4e1f2a3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# --- introspection helpers (act only on the delta) -------------------------
def _is_partitioned(conn, table: str) -> bool:
    # Compare relkind IN SQL: pg_class.relkind is the internal "char" type, which
    # the driver may not hand back as a plain Python "p" string — so a Python-side
    # ``== "p"`` can silently never match. EXISTS(...) returns a real boolean.
    return bool(
        conn.exec_driver_sql(
            "SELECT EXISTS(SELECT 1 FROM pg_class "
            f"WHERE relname = '{table}' AND relkind = 'p')"
        ).scalar()
    )


def _has_constraint(conn, table: str, name: str) -> bool:
    return bool(
        conn.exec_driver_sql(
            "SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid "
            f"WHERE t.relname = '{table}' AND c.conname = '{name}'"
        ).scalar()
    )


# Build the monthly partitions (a window around 'now') + a DEFAULT catch-all.
_MAKE_PARTITIONS = """
DO $$
DECLARE
    base date := date_trunc('month', now())::date - interval '6 months';
    m date;
    part text;
BEGIN
    FOR i IN 0..18 LOOP
        m := base + (i || ' months')::interval;
        part := 'pii_access_logs_' || to_char(m, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF pii_access_logs '
            'FOR VALUES FROM (%L) TO (%L)',
            part, m::timestamptz, (m + interval '1 month')::timestamptz);
    END LOOP;
    EXECUTE 'CREATE TABLE IF NOT EXISTS pii_access_logs_default '
            'PARTITION OF pii_access_logs DEFAULT';
END $$;
"""


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. pii_access_logs -> monthly RANGE-partitioned (only if not already so).
    if insp.has_table("pii_access_logs") and not _is_partitioned(
        conn, "pii_access_logs"
    ):
        op.execute("ALTER TABLE pii_access_logs RENAME TO pii_access_logs_legacy")
        op.execute(
            """
            CREATE TABLE pii_access_logs (
                id integer NOT NULL,
                actor_user_id uuid,
                actor_role varchar(32) NOT NULL,
                target_enroll_id integer,
                fields varchar(255) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (id, created_at)
            ) PARTITION BY RANGE (created_at)
            """
        )
        # Reuse the legacy SERIAL sequence so ids keep incrementing seamlessly.
        op.execute("ALTER SEQUENCE pii_access_logs_id_seq OWNED BY pii_access_logs.id")
        op.execute(
            "ALTER TABLE pii_access_logs ALTER COLUMN id "
            "SET DEFAULT nextval('pii_access_logs_id_seq')"
        )
        op.execute(_MAKE_PARTITIONS)
        op.execute(
            """
            INSERT INTO pii_access_logs
                (id, actor_user_id, actor_role, target_enroll_id, fields, created_at)
            SELECT id, actor_user_id, actor_role, target_enroll_id, fields, created_at
            FROM pii_access_logs_legacy
            """
        )
        op.execute(
            "SELECT setval('pii_access_logs_id_seq', "
            "GREATEST((SELECT COALESCE(MAX(id), 0) FROM pii_access_logs), 1))"
        )
        # Drop the legacy table FIRST so its (schema-scoped) index names are freed
        # before we create the identically-named indexes on the new table.
        op.execute("DROP TABLE pii_access_logs_legacy")
        op.execute(
            "CREATE INDEX ix_pii_access_logs_actor_user_id "
            "ON pii_access_logs (actor_user_id)"
        )
        op.execute(
            "CREATE INDEX ix_pii_access_logs_target_enroll_id "
            "ON pii_access_logs (target_enroll_id)"
        )
        op.execute(
            "ALTER TABLE pii_access_logs ADD CONSTRAINT "
            "pii_access_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) "
            "REFERENCES users (id) ON DELETE SET NULL"
        )
        op.execute(
            "ALTER TABLE pii_access_logs ADD CONSTRAINT "
            "pii_access_logs_target_enroll_id_fkey FOREIGN KEY (target_enroll_id) "
            "REFERENCES enrollments (id) ON DELETE SET NULL"
        )

    # 2. audit_log (general audit trail).
    if not insp.has_table("audit_log"):
        op.create_table(
            "audit_log",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "actor_user_id",
                sa.dialects.postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("actor_role", sa.String(length=32), nullable=True),
            sa.Column("action", sa.String(length=64), nullable=False),
            sa.Column("entity_type", sa.String(length=64), nullable=False),
            sa.Column("entity_id", sa.String(length=64), nullable=True),
            sa.Column("summary", sa.String(length=500), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.CheckConstraint(
                "char_length(btrim(action)) > 0", name="ck_audit_log_action_nonempty"
            ),
        )
        op.create_index(
            "ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"]
        )
        op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])
        op.create_index(
            "ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"]
        )

    # 3. enrollment natural-key UNIQUE on athlete_participation.
    if insp.has_table("athlete_participation") and not _has_constraint(
        conn, "athlete_participation", "uq_athlete_participation_natural_key"
    ):
        op.create_unique_constraint(
            "uq_athlete_participation_natural_key",
            "athlete_participation",
            ["athletes_id", "events_id", "sports_id", "category_id"],
        )

    # 4. enrollments CHECK constraints.
    if insp.has_table("enrollments"):
        if not _has_constraint(conn, "enrollments", "ck_enroll_dob_range"):
            op.create_check_constraint(
                "ck_enroll_dob_range",
                "enrollments",
                "date_of_birth >= DATE '1900-01-01' "
                "AND date_of_birth <= DATE '2100-01-01'",
            )
        if not _has_constraint(conn, "enrollments", "ck_enroll_phone_nonempty"):
            op.create_check_constraint(
                "ck_enroll_phone_nonempty",
                "enrollments",
                "char_length(btrim(phonenumber)) > 0",
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 4/3. Drop CHECKs + the participation UNIQUE (reverse order).
    if insp.has_table("enrollments"):
        for ck in ("ck_enroll_phone_nonempty", "ck_enroll_dob_range"):
            if _has_constraint(conn, "enrollments", ck):
                op.drop_constraint(ck, "enrollments", type_="check")
    if insp.has_table("athlete_participation") and _has_constraint(
        conn, "athlete_participation", "uq_athlete_participation_natural_key"
    ):
        op.drop_constraint(
            "uq_athlete_participation_natural_key",
            "athlete_participation",
            type_="unique",
        )

    # 2. Drop audit_log.
    if insp.has_table("audit_log"):
        op.drop_table("audit_log")

    # 1. Un-partition pii_access_logs back to a plain table.
    # NB: use _is_partitioned (direct pg_class check) — Inspector.has_table()
    # returns False for a partitioned table (relkind 'p') here, which would
    # otherwise silently skip this block.
    if _is_partitioned(conn, "pii_access_logs"):
        op.execute("ALTER TABLE pii_access_logs RENAME TO pii_access_logs_part")
        op.execute(
            """
            CREATE TABLE pii_access_logs (
                id integer NOT NULL,
                actor_user_id uuid,
                actor_role varchar(32) NOT NULL,
                target_enroll_id integer NOT NULL,
                fields varchar(255) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                PRIMARY KEY (id)
            )
            """
        )
        op.execute("ALTER SEQUENCE pii_access_logs_id_seq OWNED BY pii_access_logs.id")
        op.execute(
            "ALTER TABLE pii_access_logs ALTER COLUMN id "
            "SET DEFAULT nextval('pii_access_logs_id_seq')"
        )
        # SET NULL FKs may have left NULL target_enroll_id rows; the original
        # column was NOT NULL, so drop those rows on downgrade (rare path).
        op.execute(
            """
            INSERT INTO pii_access_logs
                (id, actor_user_id, actor_role, target_enroll_id, fields, created_at)
            SELECT id, actor_user_id, actor_role, target_enroll_id, fields, created_at
            FROM pii_access_logs_part
            WHERE target_enroll_id IS NOT NULL
            """
        )
        op.execute(
            "SELECT setval('pii_access_logs_id_seq', "
            "GREATEST((SELECT COALESCE(MAX(id), 0) FROM pii_access_logs), 1))"
        )
        # Drop the partitioned table FIRST to free its index names.
        op.execute("DROP TABLE pii_access_logs_part")
        op.execute(
            "CREATE INDEX ix_pii_access_logs_actor_user_id "
            "ON pii_access_logs (actor_user_id)"
        )
        op.execute(
            "CREATE INDEX ix_pii_access_logs_target_enroll_id "
            "ON pii_access_logs (target_enroll_id)"
        )
        op.execute(
            "ALTER TABLE pii_access_logs ADD CONSTRAINT "
            "pii_access_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) "
            "REFERENCES users (id) ON DELETE SET NULL"
        )
