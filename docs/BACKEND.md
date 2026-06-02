# Backend Reference — Sport Data Normalized System (Backend-V2)

FastAPI + SQLAlchemy (async) + PostgreSQL, managed with `uv`. This is the
authoritative reference for the backend, written so a solo maintainer can run,
verify, and deploy it without the original author.

> Source repo: `git@github.com:Moeyes/Backend-V2.git` (checked out at `backend/`).
> Verified live on 2026-06-02 — backend boots, DB reachable, full demo write-flow passes.

---

## 1. Run it locally

Prerequisites: `uv` (Astral), Python 3.14, a reachable PostgreSQL 16.

```bash
cd backend
uv python install 3.14.3      # first time only
uv sync                       # install deps from uv.lock   (or: make sync)

# Configure .env (see §2), ensure the database exists, then seed:
uv run python seed.py         # DROPS + recreates all tables and loads demo data

# Run the API:
make dev                      # uv run uvicorn main:app --port 8000 --reload
# prod-like:
make prod                     # uv run uvicorn main:app --host 0.0.0.0 --port 8001
```

- OpenAPI/Swagger: `http://localhost:8000/docs`
- Raw schema: `http://localhost:8000/api/openapi.json`
- Health/root: `GET http://localhost:8000/api/root/`

The API mounts **everything under `/api`** (both v1 and v2 share `API_V1_STR=/api`).

---

## 2. Environment variables

Loaded from `backend/.env` via `pydantic-settings` (`core/config.py`). Extra vars
are allowed (DB_* are read by `core/database.py`).

| Var | Purpose | Placeholder |
|-----|---------|-------------|
| `DB_USER` | Postgres user | `postgres` |
| `DB_PASS` | Postgres password | `__SET_ME__` |
| `DB_HOST` | Postgres host | `localhost` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_NAME` | Database name | `moeys` |
| `JWT_SECRET_KEY` | HS256 signing secret — **must be long & random in prod** | `__LONG_RANDOM__` |
| `JWT_ALGORITHM` | (default `HS256`) | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | access token TTL (default 30) | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | refresh token TTL (default 14) | `14` |
| `ENVIRONMENT` | `local` enables dev CORS + the `/maintenance` routes | `local` / `staging` / `production` |
| `BACKEND_CORS_ORIGINS` | allowed origins; CSV **or** JSON array | `https://staging.example.com` |
| `SENTRY_DSN` | optional; only active when `ENVIRONMENT != local` | _(unset)_ |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | optional file uploads (presigned) | _(unset)_ |

The DB connection string is assembled in `core/database.py` from the `DB_*` vars
(async driver `postgresql+asyncpg`).

---

## 3. Database setup + seed

1. Create the database: `createdb moeys` (or `CREATE DATABASE moeys;`).
2. `uv run python seed.py` — **drops and recreates all tables** (`Base.metadata.drop_all` →
   `create_all`) then loads a deterministic demo dataset:
   - 28 organizations (25 provinces + 3 ministries)
   - **48 sports**
   - 1 national demo event (`កីឡាជាតិ ២០២៦`) with **5 sports attached** + per-org links (quotas)
   - **4 roles**: `super_admin`, `admin`, `federation`, + 5 `organization` accounts
   - 1 U18 category, **1 pre-submitted by-sport survey** (`status=SUBMITTED`)
   - 1 registered **under-18 athlete** (so reports contain minor data)
   - All passwords: `password123`

> There is no Alembic/migration framework — schema is managed by SQLAlchemy
> `create_all`. For an **existing** DB that has drifted from the models, apply
> additive `ALTER TABLE`s manually (see §9). A fresh `seed.py` always matches the models.

---

## 4. Endpoint inventory (48 routes, all under `/api`)

Auth model: protected routes depend on `get_current_user`, which reads the
`access_token` **HttpOnly cookie** set by login. Public routes have no such dependency.

### auth  (public)
- `POST /api/auth/login` — body `{username, password}`; sets `access_token` + `refresh_token` cookies, returns `TokenPair`.
- `POST /api/auth/refresh` — rotates tokens using the `refresh_token` cookie.
- `GET  /api/auth/session/{user_id}` — current-user/profile lookup (**this is the "me" endpoint — there is no `/auth/me`**).

### events  (protected)
- `POST /api/events/` — create `{name_kh, type}` (`type` = Khmer enum value, e.g. `កីឡាជាតិ`).
- `GET  /api/events/` — list (paginated, `?name=` search). **Org-scoped server-side.**
- `GET  /api/events/{event_id}` · `PATCH /api/events/{event_id}` (edit name/type) · `DELETE /api/events/delete`
- `POST /api/events/add-sport` — body `{events_id, sports_id}` (attach sport to event).
- `POST /api/events/add-org-to-sport` — link an org to an event-sport.
- `GET  /api/events/{event_id}/sports` · `.../sports/{sport_id}/categories` · `.../sports/{sport_id}/orgs` · `.../organizations`
- `DELETE` variants: `remove-sport-from-event`, `delete-event-sport-org-link`, `remove-org-completely-from-event`.
- ⚠️ **There is no event "status"/publish field and no `/transitions` endpoint.** Events simply exist once created.

### sports  (protected)
- `GET /api/sports/` · `GET /api/sports/{sport_id}` · `POST /api/sports/`
- Categories: `GET /api/sports/{sport_id}/categories`, `GET /api/sports/category/{id}`, `POST/PATCH/DELETE /api/sports/category`

### organization  (protected)
- `GET /api/organization/` · `GET /api/organization/{org_id}` · `POST /api/organization/` · `PATCH /api/organization/update` · `DELETE /api/organization/delete`

### users  (protected)
- `GET /api/users/` · `GET /api/users/{user_id}` · `POST /api/users/` · `PATCH /api/users/update` · `DELETE /api/users/delete`

### registration  (protected) — athletes & leaders
- `POST /api/registration/` — `FullRegistrationRequest` (frontend-aliased fields, e.g. `firstNameKhmer`, `dateOfBirth`, `idDocType`, `role`).
- `GET  /api/registration/?role=athlete|leader` — **`role` query param is required.**
- `GET /api/registration/{enroll_id}` · `PATCH /api/registration/update` · `DELETE /api/registration/delete`

### participation-per-sport  (protected) — the "by-sport / by-number survey" + review FSM
- `POST /api/participation-per-sport/` — submit counts `{org_id, organization_id, events_id, sports_id, athlete_male_count, ...}`.
- `GET  /api/participation-per-sport/` — list (Admin review screen).
- `GET /…/{id}` · `PATCH /…/{id}` · `DELETE /…/{id}`
- `PATCH /api/participation-per-sport/{id}/review` — body `{action, note}`; `action ∈ {submit, approve, reject, flag, request_revision}`.

### reports — Excel  (protected)  ⚠️ see §8
- `GET /api/excel/org-sport?org_id=&events_id=` — attended sport-categories for an org/event.
- `GET /api/excel/org-sport-participant?org_id=&events_id=` — participant counts by sport (delegate/manager/coach/athlete × gender + grand total).

### dashboard / cards / cloudinary / public / maintenance
- `GET /api/dashboard` — role-aware stats.
- `GET /api/card/{p_id}/{org_id}/{event_id}` · `GET /api/cards/{org_id}/{event_id}` — athlete cards.
- `GET /api/cloudinary/presign-url` — presigned upload.
- `GET /api/public/events/`, `/api/public/events/{id}`, `/api/public/sports/`, `/api/public/sports/{id}` — **no auth** (SSR/metadata).
- `POST /api/maintenance/drop`, `/api/maintenance/sync-schema` — **only mounted when `ENVIRONMENT=local`** (still require auth).

---

## 5. Models & relationships

```
User ──(organization_id, nullable)──> Organization
User ──1:N──> RefreshToken
Events ──1:N──> sports_event ──> Sport            (which sports run in an event)
Events ─┐
Sport  ─┼─> sports_event_org ──> Organization     (which org runs which sport in an event)
        │        └── participation_per_sport.sports_Events_id  (FK -> sports_event_org.id)
Category ──> Sport, Events                         (age/gender divisions)
participation_per_sport ──> sports_event_org, Organization   (by-sport/by-number survey + review FSM)

Enroll (a person) ──1:1──> athletes ──1:N──> athlete_participation ──> Sport, Category, Organization, Events
Enroll            ──1:1──> leader   ──1:N──> leader_participation   ──> Sport, Organization, Events
athlete_participation ──1:N──> medals
```

- **`Enroll`** holds the person (Khmer/Latin names, DOB, gender, ID doc type, document paths). Athletes and leaders are roles layered on an enrollment.
- **`participation_per_sport`** is the survey aggregate (counts per org/sport) and carries the review FSM: `status` (default `SUBMITTED`), `review_note`, `reviewed_at`.
- Enums: `UserRole` (super_admin/admin/organization/federation), `eventType` (Khmer values), `instituteType` (province/ministry — **no federation type**, so federation users have `organization_id = NULL`), `genderEnum` (MALE/FEMALE), `IdDocumentType`, `LeaderRole`.

---

## 6. Authentication (JWT + cookies)

- `POST /auth/login` verifies the bcrypt password (`core/security.py`), then issues:
  - **access token** (HS256, `ACCESS_TOKEN_EXPIRE_MINUTES`, default 30) → `access_token` HttpOnly cookie.
  - **refresh token** (HS256 w/ `jti`, `REFRESH_TOKEN_EXPIRE_DAYS`, default 14) → `refresh_token` HttpOnly cookie; the `jti` hash is stored in `refresh_tokens`.
- `get_current_user` (`src/database/deps.py`) reads `access_token`, decodes it, loads the `User` by `sub` (UUID). Any failure → `401`.
- `POST /auth/refresh` reads the `refresh_token` cookie, validates against the stored `jti`, and rotates both tokens.
- **Server-side org scoping** (the security fix from `b645e01`): `get_effective_org_id` / `enforce_org_access` force `organization` users to their own `organization_id`, ignoring client-supplied org filters. Admin/super_admin/federation may filter freely.

---

## 7. Report generation (current reality)

Reports are served by `ExcelService` (`src/services/excel_service.py`) via the two
`/api/excel/*` endpoints. They aggregate participation/registration counts and
return **JSON** (`OrgSportParticipantFullResponse` / `OrgSportParticipantExcelResponse`).

`get_org_sport_participant_counts` returns per-sport rows broken down by
delegate/manager/coach/athlete × gender, with per-sport totals and an appended
grand-total row (`sport_name = "សរុប"`, `sport_id = null`).

---

## 8. Known gaps / post-demo backlog

1. **Reports return JSON, not real files.** The `/excel/*` endpoints emit JSON; there is **no `.xlsx` generation and no PDF at all**, and no "RPT-3/RPT-5" named templates or async job/download system. The frontend blob-downloads the JSON as `.xlsx`.
2. **Frontend ↔ backend param mismatch on reports.** The frontend reports service sends `event_id` / `organization_id`, but the endpoints read `events_id` / `org_id` → the report button currently returns `422` from the UI. (Backend is the contract; either rename frontend params or accept aliases.)
3. **No event publish/FSM.** No status field or `/transitions` endpoint — "publish" is a no-op concept today.
4. **No migration framework.** Schema drift must be fixed by hand (see §9). Adopt Alembic post-demo.
5. **Duplicate operation IDs** warned at startup (`events-list_events`, `root-root`) — there are two `list_events` defs in `events.py`; harmless but worth deduping.

---

## 9. Fixes applied on 2026-06-02 (Day 7, minimal, no rebuild)

- **Schema drift:** the live `participation_per_sport` table was missing the model's
  `status`, `review_note`, `reviewed_at` columns → every survey list/review threw `500`.
  Fixed additively (a fresh `seed.py` already includes them):
  ```sql
  ALTER TABLE participation_per_sport
    ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'SUBMITTED',
    ADD COLUMN IF NOT EXISTS review_note varchar,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamp without time zone;
  ```
- **Stale response schema:** `SportParticipantCount` (`src/schemas/excel.py`) declared
  `male/female/leader`, but `ExcelService` returns the delegate/manager/coach/athlete
  breakdown with a `sport_id=null` total row → `org-sport-participant` threw `500`.
  Updated the schema to mirror the service (all count fields, `sport_id` optional).

---

## 10. Deploy

See **`docs/STAGING_DEPLOY.md`** for the full VPS + Docker procedure. In brief:
build the image (`uv sync` → `uvicorn main:app --host 0.0.0.0 --port 8001`), provide
the `.env` (real `JWT_SECRET_KEY`, DB creds, `ENVIRONMENT=staging`, `BACKEND_CORS_ORIGINS`
= the staging frontend URL), point it at a managed Postgres, run `seed.py` once, and
front it with nginx/TLS.
