# Schema Authority Audit — out-of-band schema mutation inventory

**Scope:** backend (`/home/panha/moeys/backend`). **Mode:** read-only audit. No code
was modified. This report recommends; it does not apply.

**Goal:** find every place application code creates or alters the database schema
*outside* Alembic migrations, so we can make `alembic upgrade head` the single source of
truth and stop `alembic_version` drifting from the real schema.

---

## TL;DR — the root cause

The recurring crashes are not just a few stray `ALTER` helpers. **Alembic cannot build
this schema from an empty database at all.** The `initial_schema` migration
(`425f25068de6`) does *not* `create_table` the core tables — it only adds
`pii_access_logs`, one `users` column, and indexes, while running `op.add_column('users', …)`
and `CREATE INDEX … ON enrollments/athlete_participation/…`. Those statements assume the
core tables already exist. They exist because **`Base.metadata.create_all` is the real
authority for ~15 core tables**, and Alembic only ever carried *deltas* on top.

So today there are **two schema authorities running in parallel**:

1. `Base.metadata.create_all` (driven by `src/models/*.py`) — builds the 15 core tables.
2. Alembic migrations — build 8 newer tables + assorted columns/indexes/enums.

Any model change to a core table that nobody mirrors into a migration silently relies on
`create_all` / the `sync-schema` "ensure" helpers to patch live DBs, and `alembic_version`
never reflects it. That is the drift.

**The good news:** the app **startup path is clean** — the FastAPI `lifespan` does no
schema work (see §4). Restarts do not re-create schema. The drift is introduced only by
the manual mechanisms below.

---

## Inventory

| # | Mechanism | file:line | What it does | Who can call it | Risk |
|---|-----------|-----------|--------------|-----------------|------|
| 1 | `Base.metadata.create_all` (sync-schema) | `src/api/v1/routes/maintenance.py:22` | Creates *all* missing tables from `Base.metadata` (the models) | `POST /api/v1/maintenance/sync-schema`, `require_admin`; router mounted **only when `ENVIRONMENT == "local"`** | **HIGH** — primary authority for the 15 core tables on any env where it ran; competes with Alembic |
| 2 | `_ensure_sport_type_column` | `src/api/v1/routes/maintenance.py:25-33,68` | `ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type VARCHAR(100)` | same endpoint | **HIGH** — only mechanism (besides create_all) that adds `sports.sport_type`; **no migration exists** |
| 3 | `_ensure_org_sports_unique_index` | `src/api/v1/routes/maintenance.py:35-44,69` | `CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_event_org_keys ON sports_event_org (...) WHERE ...` | same endpoint | **HIGH** — only mechanism creating this unique index; **no migration exists** |
| 4 | `_ensure_participation_review_columns` | `src/api/v1/routes/maintenance.py:48-66,70` | `ALTER TABLE participation_per_sport ADD COLUMN IF NOT EXISTS status/review_note/reviewed_at` | same endpoint | **HIGH** — only mechanism adding the by-number review FSM columns; **no migration exists** |
| 5 | `Base.metadata.drop_all` (drop) | `src/api/v1/routes/maintenance.py:75-83` | Drops **all** tables (full reset) | `POST /api/v1/maintenance/drop`, `require_admin`, local-only | **CRITICAL (destructive)** — not a drift source, but an out-of-band DDL surface that must not exist in prod |
| 6 | `Base.metadata.create_all` (seed) | `seed.py:88` | Creates all tables, then inserts demo data | manual `python seed.py` | **MEDIUM** — dev bootstrap; a second schema authority parallel to Alembic |
| 7 | `Base.metadata.create_all` (CI bootstrap) | `scripts/init_db_schema.py:24` | Imports `main` (registers every model) then `create_all` | manual / **CI**; documented "fresh environments only" | **MEDIUM** — this is what gives the **test DB its schema** (conftest does not); removing create_all breaks CI unless replaced |
| 8 | App startup `lifespan` | `main.py:38-41` | `yield`, then `close_redis()` — **no schema work** | automatic at every boot | **NONE** — already safe; nothing to remove |
| 9 | Test schema setup | `tests/conftest.py` (whole file) | **No** `create_all`/`upgrade`; joins a rolled-back transaction on the live `DATABASE_URL` | `pytest` | **N/A (dependency)** — tests assume the DB is *already* built (by #7 in CI) |

Notes on the guard for #1–#5: the maintenance router is mounted only when
`settings.ENVIRONMENT == "local"` (exact, case-sensitive — `src/api/main.py:110-116`),
and every endpoint additionally requires `require_admin`. So in production these endpoints
are **not routable**. The helpers and `create_all` calls still exist in the codebase, and
the *drift they were written to patch* is real in any DB they ever touched.

---

## Detailed findings (matching the five requested items)

### 1. Every `create_all` / `Base.metadata.create_all`

| Location | Context |
|----------|---------|
| `src/api/v1/routes/maintenance.py:22` | inside `sync_schema()` — `await conn.run_sync(Base.metadata.create_all, checkfirst=checkfirst)` |
| `seed.py:88` | inside `seed_data()` — bootstrap before inserting demo rows |
| `scripts/init_db_schema.py:24` | inside `_create()` — documented CI / fresh-env bootstrap |

`drop_all`: `src/api/v1/routes/maintenance.py:82` (the `/drop` endpoint).

No `create_all` runs in `main.py`, the app factory (`src/api/main.py`), the `lifespan`, or
any startup event. (The `tests/test_file_access.py` "create_all…" hits in the original grep
are function names like `test_user_create_allows_external_url`, not schema calls.)

### 2. The maintenance / sync-schema endpoint

`src/api/v1/routes/maintenance.py` defines two endpoints:

- `POST /sync-schema` (`maintenance.py:11-72`) — `require_admin`. It:
  1. `create_all(checkfirst=...)` — line 22.
  2. `_ensure_sport_type_column` — lines 25-33: inspects `sports`, adds `sport_type` if absent.
  3. `_ensure_org_sports_unique_index` — lines 35-44: creates partial unique index `uq_sports_event_org_keys`.
  4. `_ensure_participation_review_columns` — lines 48-66: adds `status` / `review_note` / `reviewed_at` to `participation_per_sport`.
- `POST /drop` (`maintenance.py:75-83`) — `require_admin`. `drop_all` — destroys everything.

Auth guard: both depend on `require_admin` (ADMIN/SUPER_ADMIN). Routability: the router is
included only when `ENVIRONMENT == "local"` (`src/api/main.py:110-116`). No code path,
frontend, script, Dockerfile, or compose file auto-invokes `sync-schema` — it is
manual-only.

### 3. Raw DDL in the app (outside `alembic/versions/`)

All raw DDL lives in `maintenance.py` (items 2–4 above). Statements:

```text
maintenance.py:31  ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type VARCHAR(100)
maintenance.py:39  CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_event_org_keys
                   ON sports_event_org (events_id, sports_id, organization_id)
                   WHERE events_id IS NOT NULL AND sports_id IS NOT NULL AND organization_id IS NOT NULL
maintenance.py:52  ALTER TABLE participation_per_sport ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED'
maintenance.py:58  ALTER TABLE participation_per_sport ADD COLUMN IF NOT EXISTS review_note TEXT
maintenance.py:64  ALTER TABLE participation_per_sport ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP
```

No raw `ALTER`/`CREATE TABLE`/`ADD COLUMN` exists anywhere else in `src/`, `seed.py`, or
`scripts/`. (Migrations legitimately use `op.execute(...)` for indexes/extensions — those
are in-Alembic and not in scope.)

### 4. App STARTUP path — **clean**

`main.py:38-41`:

```python
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()
```

No `create_all`, no `sync-schema`, no migration call on startup. The Dockerfile `CMD` is
plain `uvicorn main:app …` (`Dockerfile:22-23,38-39`); neither stage, nor any
`docker-compose*.yml`, runs `alembic upgrade`, `seed`, or `create_all` at container start.

Two implications:
- **Good:** restarts do not re-introduce drift (this was the most dangerous possibility and
  it is *not* present).
- **Latent gap:** nothing runs `alembic upgrade head` automatically either, so migrations
  are applied by hand. That is itself a drift vector and should be fixed when Alembic becomes
  authoritative (see Removal Plan, Phase 4).

### 5. How tests set up their DB schema

`tests/conftest.py` does **not** create schema. `test_engine` connects to the real
`DATABASE_URL` with `NullPool`; `db_session` opens an outer transaction joined via
`join_transaction_mode="create_savepoint"` and **rolls it back** at teardown. Tests assume
the schema already exists. In CI that schema comes from
`scripts/init_db_schema.py` → `create_all` (item #7), per its own docstring
("notably in CI, where there is no migrated database to test against").

> Consequence: removing `create_all` without repointing CI at `alembic upgrade head` will
> leave the test database empty and **break the entire suite**. This is a hard dependency.

---

## Migration chain (single linear head — confirmed)

```
425f25068de6 (initial)            <- None      ── only adds pii_access_logs + users col + indexes
  01e2671a48d6 (failed_attempts)
    834864ee56c1 (search_text)
      a1b2c3d4e5f6 (athlete idx)
        b2c3d4e5f6a7 (uploaded_files)       create_table: uploaded_files
          757ed5271195 (org name_en)
            d58f7c21045b (gender enum +MIXED)
              b3f1a82c9d70 (phase2 sport config)
                c4d5e6f7g8h9 (phase3 teams)         create_table: teams
                  d5e6f7g8h9i0 (phase4 organizers)  create_table: organizer_roles, organizer_participation
                    e6f7g8h9i0j1 (phase5 open survey)  create_table: open_survey_fields, open_survey_responses
                      f7a8b9c0d1e2 (phase6 category review)  create_table: category_survey_review
                        a9b8c7d6e5f4 (phase6b sport_event_org review)  <- HEAD
```

`env.py` is correct: `target_metadata = Base.metadata`, imports all models. One linear
head. Migrations are hand-written with up/down.

### Coverage gap — tables created by `create_all` but by NO migration

`op.create_table` exists in migrations only for **8** tables:
`pii_access_logs`, `uploaded_files`, `teams`, `organizer_roles`,
`organizer_participation`, `open_survey_fields`, `open_survey_responses`,
`category_survey_review`.

The models declare **23** tables. The **15** never created by any migration (built only by
`create_all`):

```
users            sports            events           organizations
enrollments      athletes          leaders          categories
medals           refresh_tokens    sports_event     sports_event_org
athlete_participation   leader_participation   participation_per_sport
```

### Column / index gaps that `maintenance.py` patches and NO migration covers

| Object | Declared in model | Migration? | Patched out-of-band by |
|--------|-------------------|------------|------------------------|
| `sports.sport_type` (`String(100)`, nullable) | `src/models/sport.py:13` | **none** | `_ensure_sport_type_column` + create_all |
| `uq_sports_event_org_keys` (partial unique idx) | (index, not a column) | **none** | `_ensure_org_sports_unique_index` |
| `participation_per_sport.status` (`String(32)` NOT NULL `'SUBMITTED'`), `review_note`, `reviewed_at` | `src/models/participation_per_sport.py:38-43` | **none** | `_ensure_participation_review_columns` + create_all |

**Already fixed precedent:** the *same* class of bug for `sports_event_org.status /
review_note / reviewed_at` **was** resolved by migration `a9b8c7d6e5f4` using an
inspect-guarded idempotent `op.add_column`. That migration is the **template** for the
remaining gaps — copy its pattern.

> Note: `a9b8` added `sports_event_org.status` as `String(32)` while the model declares
> `String(20)` (documented length drift, harmless). And the `review_status` enum referenced
> in older notes no longer exists in the model — `participation_per_sport` carries only a
> plain `status String(32)`. Verify the model's `sports_event_org.status` length when you
> reconcile, but it is not a crash source.

---

## REMOVAL PLAN — make Alembic the sole schema authority

Ordered and behavior-preserving. **Each "write a migration" step must land and be proven
reversible (`upgrade head → downgrade -1 → upgrade head`) before the matching removal
step.** Items flagged ⛔ **cannot** be removed until a migration exists first.

### Phase 0 — Capture the truth (no code change)
1. On a known-good DB currently at head (one built by `create_all`), run
   `pg_dump --schema-only` to capture the *real* schema. This is the spec the new baseline
   migration must reproduce exactly (columns, types, server defaults, FKs, enums, indexes).
2. Diff that dump against `Base.metadata` to catch any *other* silent drift beyond the three
   known gaps before you freeze the baseline.

### Phase 1 — Write the missing migrations (⛔ must precede every removal)
3. ⛔ **Baseline "create core schema" migration.** Author a migration that `create_table`s
   the **15 core tables** (and creates the pg enums they use: `user_role`, gender, event/org
   types, etc., with `create_type` handled so it is reusable) reproducing the Phase 0 dump.
   Make it **idempotent** (guard with `inspect`/`IF NOT EXISTS`) so it is a no-op on every
   existing `create_all`'d DB but builds a fresh DB from empty.
   - Positioning is the one rule-tension: the chain root (`425f25068de6`) currently has
     `down_revision = None` and *depends on these tables already existing*. To let
     `alembic upgrade head` build from empty, this baseline must run **before** `425f`. That
     means either (a) relink `425f.down_revision` to the new baseline (a one-line history
     relink of an already-merged migration — **flag for explicit sign-off**, since the skill
     says merged migrations don't change), or (b) squash the whole chain into a single new
     baseline and `alembic stamp` every existing environment. **Recommend (a)** — smaller,
     keeps history — but it requires the team's OK to touch `425f`'s `down_revision`.
4. ⛔ **Reconcile-drift migration** (down_revision = current head `a9b8c7d6e5f4`), copying
   the idempotent `a9b8` pattern, covering the three gaps:
   - `sports.sport_type` (`ADD COLUMN IF NOT EXISTS`, `String(100)`, nullable);
   - `uq_sports_event_org_keys` (`CREATE UNIQUE INDEX IF NOT EXISTS … WHERE …`);
   - `participation_per_sport.status` / `review_note` / `reviewed_at` (inspect-guarded adds,
     `status` `String(32)` NOT NULL default `'SUBMITTED'`).
   On a fresh DB the Phase-1 baseline (step 3) already creates these correctly, so the guards
   make this a no-op there; on existing/drifted DBs it backfills whatever `maintenance.py`
   would have. Idempotent both ways.

### Phase 2 — Reconcile every existing environment
5. Run `alembic upgrade head` on **each** deployed/dev/CI database. Because steps 3–4 are
   inspect-guarded, this is safe whether or not `sync-schema` had already added the
   columns/index. Confirm each DB ends at the new head and `alembic check` reports no diff
   vs `Base.metadata`.

### Phase 3 — Remove the out-of-band mechanisms (only after Phases 1–2 verified)
6. Repoint CI: change `scripts/init_db_schema.py` to run `alembic upgrade head` instead of
   `create_all` (or have CI invoke Alembic directly). **This must happen in lockstep with
   removing create_all**, or the test suite loses its schema (conftest builds none).
7. Change `seed.py` to assume an already-migrated DB (drop line 88's `create_all`, or shell
   out to `alembic upgrade head` first).
8. Delete the drift helpers and `create_all` from `sync-schema`:
   `_ensure_sport_type_column`, `_ensure_org_sports_unique_index`,
   `_ensure_participation_review_columns`, and the `create_all` call — i.e. remove the
   `/sync-schema` endpoint. Remove (or keep strictly local-only and clearly labeled) the
   `/drop` endpoint; ideally drop the whole `maintenance` router so no out-of-band DDL
   surface remains.

### Phase 4 — Enforce it going forward
9. Add a CI gate: `alembic upgrade head` against an **empty** Postgres must succeed (proves
   Alembic alone builds the schema), plus `alembic check` / autogenerate-produces-no-diff so
   any future model↔migration drift fails the build.
10. Add an explicit `alembic upgrade head` step to the deploy/boot sequence (currently
    nothing runs it automatically — `Dockerfile:38-39` is just uvicorn). Run it as a
    pre-start job, **not** in the app `lifespan` (keep startup schema-free).

---

## Dependencies — what blocks removal (must have a migration first)

| Remove this… | …blocked until | Why |
|--------------|----------------|-----|
| `create_all` (maintenance / seed / init_db_schema) | **Baseline migration (step 3)** exists & verified | 15 core tables have no `create_table` in any migration; `alembic upgrade head` on an empty DB fails at `425f`'s `add_column('users', …)` |
| `_ensure_sport_type_column` | **Migration for `sports.sport_type` (step 4)** | no migration adds the column |
| `_ensure_org_sports_unique_index` | **Migration for `uq_sports_event_org_keys` (step 4)** | no migration creates the index |
| `_ensure_participation_review_columns` | **Migration for the 3 columns (step 4)** | no migration adds them |
| `scripts/init_db_schema.py` `create_all` | **CI repointed to `alembic upgrade head` (step 6)**, which itself needs the baseline | conftest creates no schema; CI tests depend on this bootstrap |
| `seed.py` `create_all` | baseline migration (then `alembic upgrade head` before seeding) | dev bootstrap relies on it for table creation |

**No migration needed (already safe to leave / no work):**
- App startup `lifespan` (`main.py:38-41`) — does no schema work.
- `sports_event_org` review columns — already covered idempotently by `a9b8c7d6e5f4`
  (use it as the pattern for step 4).

---

## One-line bottom line

Startup is clean, but Alembic is **not** currently able to build the schema from zero —
`create_all` is a co-authority for 15 core tables and three column/index gaps are patched
only by the `sync-schema` "ensure" helpers. Removing the out-of-band mechanisms is safe
**only after** a baseline migration (creating the 15 core tables) and a reconcile migration
(the three gaps) land and every environment is upgraded; CI must switch from `create_all`
to `alembic upgrade head` in the same change or the test suite goes dark.
