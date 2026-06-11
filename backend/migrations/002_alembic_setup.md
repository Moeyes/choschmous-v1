# Alembic Migration Workflow

Alembic is installed and configured for async PostgreSQL (asyncpg).

## Initial setup (already done)
```
uv add alembic
alembic init alembic
```

## First-time deployment on a fresh database
The initial migration (`425f25068de6`) creates all tables, indexes, and the `token_valid_from` column:

```bash
alembic upgrade head
```

## First-time deployment on an existing database
The initial migration only captures the delta (new tables/columns not yet created).
Stamp the current state without running any changes:

```bash
alembic stamp 425f25068de6
```

This marks the existing database as up-to-date with the initial schema.

## Daily use — after model changes
1. Make changes to SQLAlchemy model files in `src/models/`
2. Generate a new migration:
   ```bash
   alembic revision --autogenerate -m "description_of_change"
   ```
3. Review the generated migration in `alembic/versions/`
4. Apply it:
   ```bash
   alembic upgrade head
   ```
5. Rollback if needed:
   ```bash
   alembic downgrade -1
   ```

## Important notes
- The `alembic/env.py` reads `DB_*` env vars from `.env` — no hardcoded connection string.
- `src/models/__init__.py` must import every model class for autogenerate to detect them.
- `CREATE INDEX CONCURRENTLY` is NOT used in migrations (runs inside a transaction).
  On production with live traffic, create indexes manually with `CONCURRENTLY`.
