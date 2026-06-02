# Rollback & Recovery

For the demo build, tagged **`v0.5-demo`**.

## Backup (take before the demo)

```bash
# On the VPS / wherever Postgres runs:
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -Fc \
  -f "moeys-staging-$(date +%Y%m%d-%H%M).dump"
# Copy off-box:
scp moeys-staging-*.dump backups@yourhost:/backups/
```

(For local dev: `PGPASSWORD=postgres pg_dump -h localhost -U postgres -d moeys -Fc -f moeys-local.dump`.)

## Restore the database

```bash
# Recreate clean and restore:
dropdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" && createdb -h "$DB_HOST" -U "$DB_USER" "$DB_NAME"
pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" --no-owner moeys-staging-YYYYMMDD-HHMM.dump
```

Or, fastest path for a demo: re-run the deterministic seed (drops + recreates + reloads):
```bash
docker compose exec backend uv run python seed.py     # staging
# or, local:   cd backend && uv run python seed.py
```

## Roll back the code

```bash
# Return the working tree to the demo tag:
git fetch --tags
git checkout v0.5-demo
git submodule update --init --recursive   # restore frontend/ + backend/ to the tagged commits
```

To redeploy the tagged build on the VPS:
```bash
git checkout v0.5-demo && git submodule update --init --recursive
docker compose build && docker compose up -d
```

## If the live demo breaks

1. Switch the browser to **localhost** (identical seed data) — backend `make dev`, frontend `pnpm dev`.
2. If that also fails, play the **pre-recorded screen capture**.
3. After the demo, restore staging from the latest `pg_dump` or re-seed.

## Known-good reference state (`v0.5-demo`)
- 28 orgs · 48 sports · event `កីឡាជាតិ ២០២៦` (5 sports) · 1 SUBMITTED survey · 1 U18 athlete · 4 roles (8 users).
- Backend fixes included: `participation_per_sport` status columns; `SportParticipantCount` schema (see `docs/BACKEND.md` §9).
