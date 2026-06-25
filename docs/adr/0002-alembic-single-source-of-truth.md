# ADR-0002: Alembic is the single source of truth for schema

- **Status:** accepted
- **Date:** 2026-06-25
- **Deciders:** Platform team
- **Ticket:** CHOS-506

## Context

The repository carried two parallel migration mechanisms: hand-run raw SQL files
in `backend/migrations/*.sql` (applied manually with `psql -f`) **and** Alembic
revisions in `backend/alembic/versions/`. The baseline Alembic migration
(`425f25068de6`) already reproduced everything the raw SQL did (the performance
indexes and the `token_valid_from` column/backfill). Keeping both invited drift:
an environment could have the raw SQL applied but not be stamped in Alembic, or
vice-versa, and there was no single command that described the schema.

## Decision

We will use **Alembic as the only migration mechanism**. The raw
`backend/migrations/*.sql` files (and the `migrations/` directory) are removed.
All schema changes go through reviewed Alembic revisions with explicit,
reversibility-proven `upgrade()`/`downgrade()` and a single linear head.

The one capability the raw SQL uniquely provided — creating indexes
`CONCURRENTLY` on a live production DB (Alembic runs in a transaction and cannot)
— is preserved as an operational procedure in
[`../runbooks/db-migrations.md`](../runbooks/db-migrations.md), not as a parallel
migration system.

## Consequences

- Positive: one source of truth; `alembic upgrade head` fully describes the
  schema; no manual-vs-Alembic drift; reversibility is enforced.
- Negative: production index creation is a documented manual step before the
  migration, rather than a file someone runs.
- Follow-ups: the `migrations.yml` CI workflow validates the linear head and
  up/down on every change.

## Alternatives considered

- **Keep both** — the status quo that caused drift risk; rejected.
- **Raw SQL only** — loses autogenerate, reversibility, head tracking, and CI
  validation; rejected.
