# Runbook: Database migrations (Alembic)

> Operational runbook. Alembic is the **single source of truth** for schema
> (CHOS-506 / [ADR-0002](../adr/0002-alembic-single-source-of-truth.md)). The raw
> `backend/migrations/*.sql` files were retired; everything below is Alembic.

Alembic is configured for async PostgreSQL (asyncpg); `alembic/env.py` reads the
`DB_*` env vars from `.env` (no hardcoded connection string).

## Daily use — after a model change

1. Edit the SQLAlchemy models in `backend/src/models/`.
2. Ensure the model is exported in `src/models/__init__.py` (autogenerate only
   detects imported classes).
3. Generate, **review**, then apply:
   ```bash
   cd backend
   alembic revision --autogenerate -m "description_of_change"
   # review the generated file in alembic/versions/ — hand-write up()/down()
   alembic upgrade head
   ```
4. Prove reversibility before merging: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.

Keep **one linear head**: a new revision's `down_revision` chains to the current
single head. Reuse shared PG enum types with `create_type=False`; never drop a
shared enum in `downgrade()`.

## Fresh database

```bash
alembic upgrade head
```

## Existing (pre-Alembic) database

The initial migration (`425f25068de6`) captures the full baseline. Stamp an
already-populated DB as current without running changes:

```bash
alembic stamp 425f25068de6
```

## Creating indexes on a live production DB (CONCURRENTLY)

Migrations run inside a transaction, so they create indexes **without**
`CONCURRENTLY` — which takes a write lock. On a high-traffic production database,
create the index `CONCURRENTLY` out-of-band **first** (it is then a no-op when the
migration's `CREATE INDEX IF NOT EXISTS` runs). The baseline performance indexes
(formerly `migrations/001_add_indexes.sql`) as concurrent DDL:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_phonenumber_trgm
    ON enrollments USING gin (phonenumber gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_athlete_participation_org_event
    ON athlete_participation (organization_id, events_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leader_participation_org_event
    ON leader_participation (organization_id, events_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participation_per_sport_org
    ON participation_per_sport (org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participation_per_sport_sports_events
    ON participation_per_sport ("sports_Events_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sports_event_org_composite
    ON sports_event_org (events_id, sports_id, organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sports_event_composite
    ON sports_event (events_id, sports_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_created_at_desc
    ON enrollments (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_kh_name
    ON enrollments USING gin (kh_family_name gin_trgm_ops, kh_given_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_en_name
    ON enrollments USING gin (en_family_name gin_trgm_ops, en_given_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_athlete_participation_sport_event
    ON athlete_participation (sports_id, events_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leader_participation_sport_event
    ON leader_participation (sports_id, events_id);
```

> NB: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction — execute each
> statement on its own connection (e.g. `psql -c`), not in a `BEGIN…COMMIT`.

## Rollback

```bash
alembic downgrade -1     # one step
alembic downgrade <rev>  # to a specific revision
```

Model class names are PascalCase but `__tablename__` is unchanged
([ADR-0003](../adr/0003-pascalcase-orm-model-class-names.md)), so the rename
required **no** migration — the schema is identical.
