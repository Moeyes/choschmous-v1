"""CHOS-403: field-level PII encryption columns + hash-chained append-only audit_log

Revision ID: d403a1b2c3d4
Revises: d401a1b2c3d4
Create Date: 2026-06-24

What this migration does (on a real, migration-driven database):
  1. Widens ``enrollments.phonenumber`` (100→255) and ``user_mfa.totp_secret``
     (64→255) to hold envelope CIPHERTEXT instead of plaintext, and adds
     ``enrollments.national_id`` (encrypted national-id number). The app reads/
     writes plaintext through the EncryptedString type; the column stores
     ciphertext at rest. Existing plaintext rows keep working (the type detects
     the missing ``kms1:`` marker) until a one-off backfill re-encrypts them.
  2. Rebuilds the ``enrollments.search_text`` generated column to drop
     ``phonenumber`` from the index — PII must not sit in a plaintext, searchable
     column. (A generated column's expression can't be ALTERed in place, so it is
     dropped and re-added.)
  3. Adds the tamper-evident hash-chain columns ``prev_hash`` / ``row_hash`` to
     ``audit_log`` (+ a UNIQUE on ``row_hash``), and an append-only trigger that
     RAISES on UPDATE/DELETE (defence in depth behind the chain).

Idempotent / delta-only, following the project's reconcile pattern (the CI/test
schema is built by ``create_all`` from the models and this migration is then
``stamp``-ed, never run there): every step inspects the live bind and only acts
on what is missing/stale, so it is safe both on a fresh ``create_all`` DB and on
a real DB sitting at the previous head.

NOTE (backfill): re-encrypting pre-existing plaintext rows is a Python data step
(the cipher lives in app/infrastructure/db/crypto.py), not raw SQL. Run it after
this migration in any environment that already holds plaintext PII.
TODO(ops): ship that backfill as a one-shot job and run it before enabling the
append-only trigger in a populated environment.
"""

from alembic import op
import sqlalchemy as sa

revision = "d403a1b2c3d4"
down_revision = "d401a1b2c3d4"
branch_labels = None
depends_on = None


_SEARCH_TEXT_NAMES_ONLY = (
    "COALESCE(kh_family_name, '') || ' ' || COALESCE(kh_given_name, '') || ' ' || "
    "COALESCE(en_family_name, '') || ' ' || COALESCE(en_given_name, '')"
)
_SEARCH_TEXT_WITH_PHONE = (
    "COALESCE(kh_family_name, '') || ' ' || COALESCE(kh_given_name, '') || ' ' || "
    "COALESCE(en_family_name, '') || ' ' || COALESCE(en_given_name, '') || ' ' || "
    "COALESCE(phonenumber, '')"
)


def _cols(insp, table):
    return {c["name"]: c for c in insp.get_columns(table)}


def _gen_expr(bind, table, column):
    return bind.execute(
        sa.text(
            "SELECT generation_expression FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).scalar()


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    # ── enrollments: widen phone, add national_id, de-PII the search index ───
    # Postgres forbids ALTERing a column that a GENERATED column depends on, so
    # search_text must be dropped BEFORE the phonenumber type change and re-added
    # (names-only) AFTER.
    if "enrollments" in tables:
        enr = _cols(insp, "enrollments")
        expr = _gen_expr(bind, "enrollments", "search_text") or ""
        need_phone_alter = (
            "phonenumber" in enr and enr["phonenumber"]["type"].length != 255
        )
        rebuild_search = ("phonenumber" in expr) or need_phone_alter

        if rebuild_search and "search_text" in enr:
            op.drop_column("enrollments", "search_text")
        if need_phone_alter:
            op.alter_column(
                "enrollments",
                "phonenumber",
                type_=sa.String(255),
                existing_nullable=False,
            )
        if "national_id" not in enr:
            op.add_column(
                "enrollments",
                sa.Column("national_id", sa.String(255), nullable=True),
            )
        if rebuild_search:
            op.add_column(
                "enrollments",
                sa.Column(
                    "search_text",
                    sa.String(605),
                    sa.Computed(_SEARCH_TEXT_NAMES_ONLY),
                    nullable=True,
                ),
            )

    # ── user_mfa: widen totp_secret for ciphertext ──────────────────────────
    if "user_mfa" in tables:
        mfa = _cols(insp, "user_mfa")
        if "totp_secret" in mfa and mfa["totp_secret"]["type"].length != 255:
            op.alter_column(
                "user_mfa",
                "totp_secret",
                type_=sa.String(255),
                existing_nullable=True,
            )

    # ── audit_log: hash-chain columns + append-only trigger ─────────────────
    if "audit_log" in tables:
        al = _cols(insp, "audit_log")
        if "prev_hash" not in al:
            # New table in practice (empty), so a NOT NULL add is safe; a genesis
            # default covers any stray pre-existing rows without breaking the add.
            op.add_column(
                "audit_log",
                sa.Column(
                    "prev_hash",
                    sa.String(64),
                    nullable=False,
                    server_default=("0" * 64),
                ),
            )
            op.alter_column("audit_log", "prev_hash", server_default=None)
        if "row_hash" not in al:
            op.add_column(
                "audit_log",
                sa.Column(
                    "row_hash",
                    sa.String(64),
                    nullable=False,
                    server_default="",
                ),
            )
            op.alter_column("audit_log", "row_hash", server_default=None)
            op.create_unique_constraint(
                "audit_log_row_hash_key", "audit_log", ["row_hash"]
            )

        # Append-only: block UPDATE/DELETE at the DB so the audit trail cannot be
        # rewritten in place even with direct table access. Idempotent.
        op.execute(
            """
            CREATE OR REPLACE FUNCTION audit_log_append_only()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute("DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log")
        op.execute(
            """
            CREATE TRIGGER trg_audit_log_append_only
            BEFORE UPDATE OR DELETE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "audit_log" in tables:
        op.execute("DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log")
        op.execute("DROP FUNCTION IF EXISTS audit_log_append_only()")
        al = _cols(insp, "audit_log")
        if "row_hash" in al:
            op.drop_constraint(
                "audit_log_row_hash_key", "audit_log", type_="unique"
            )
            op.drop_column("audit_log", "row_hash")
        if "prev_hash" in al:
            op.drop_column("audit_log", "prev_hash")

    if "user_mfa" in tables:
        mfa = _cols(insp, "user_mfa")
        if "totp_secret" in mfa and mfa["totp_secret"]["type"].length != 64:
            op.alter_column(
                "user_mfa",
                "totp_secret",
                type_=sa.String(64),
                existing_nullable=True,
            )

    if "enrollments" in tables:
        enr = _cols(insp, "enrollments")
        expr = _gen_expr(bind, "enrollments", "search_text") or ""
        need_phone_narrow = (
            "phonenumber" in enr and enr["phonenumber"]["type"].length != 100
        )
        rebuild_search = ("phonenumber" not in expr) or need_phone_narrow

        # Drop the generated column first so the phonenumber type change is
        # allowed, then narrow, drop national_id, and re-add search_text WITH
        # phone (the pre-CHOS-403 definition).
        if rebuild_search and "search_text" in enr:
            op.drop_column("enrollments", "search_text")
        if need_phone_narrow:
            op.alter_column(
                "enrollments",
                "phonenumber",
                type_=sa.String(100),
                existing_nullable=False,
            )
        if "national_id" in enr:
            op.drop_column("enrollments", "national_id")
        if rebuild_search:
            op.add_column(
                "enrollments",
                sa.Column(
                    "search_text",
                    sa.String(605),
                    sa.Computed(_SEARCH_TEXT_WITH_PHONE),
                    nullable=True,
                ),
            )
