# Complete Audit & Remediation Summary

**Date:** June 4, 2026
**Project:** MOEYS (Ministry of Education, Youth and Sport)

---

## Phase 1 — Stabilization & Remediation

### Initial State
- Tests failing due to: event loop conflicts, CSRF cookie missing, rate limiter pollution, Redis unavailability, dashboard caching broken, enum validation mismatches
- 19 deprecation warnings (Pydantic v2 migration, `@app.on_event`, `sqlalchemy.ext.declarative`)

### Fixes Applied

| Category | Fix | Files Changed |
|----------|-----|---------------|
| **Test infra** | Session-scoped event loop, per-test client isolation, CSRF token in every client, rate limiter reset fixture | `pyproject.toml`, `tests/conftest.py` |
| **Redis resilience** | Wrapped all `cache_*`/`get_redis()` in `try/except (RedisError, ConnectionError)` returning `None` | `core/cache.py`, `core/redis_client.py` |
| **Dashboard** | Removed broken `Events(**e)` cache serialization and `asyncio.gather` (asyncpg forbids concurrent ops on single connection) | `src/services/dashboard_service.py` |
| **Enum validation (Pydantic v2)** | All test payloads use `.value` (Khmer strings) instead of uppercase enum names | 6 test files |
| **Deprecation warnings** | Migrated `@app.on_event` → `lifespan`, `class Config` → `model_config = ConfigDict(...)`, `sqlalchemy.ext.declarative` → `sqlalchemy.orm`, `r.setex` → `r.set(..., ex=...)`, extended JWT secrets to 32+ bytes | `main.py`, `src/schemas/dashboard.py`, `core/database.py`, `core/cache.py`, `core/config.py` |
| **Event tests** | Fixed create status (200→201), delete method, auth dependencies | `tests/api/test_events.py` |
| **Org tests** | Fixed `type` field to lowercase enum value, status codes | `tests/api/test_organization.py` |
| **Participant tests** | Fixed role query param, response key `total`→`count` | `tests/api/test_participant.py` |
| **App code fixes** | Added `IntegrityError` catch in users/sports_events, fixed `patch`/`delete` in participation_per_sport_service | 3 service/route files |
| **Dead code activation** | Wired `sports_events` router into `main.py` at `/api/sports-events` | `main.py` |

### Test Coverage Added

| Test File | Tests | Covers |
|-----------|-------|--------|
| `tests/api/test_users.py` | 15 | CRUD + superadmin-only + auth checks |
| `tests/api/test_excel.py` | 6 | Both export endpoints ± org_id, validation |
| `tests/api/test_participation_per_sport.py` | 15 | CRUD + review FSM + auth |
| `tests/api/test_sports_events.py` | 9 | List, create, delete |
| `tests/api/test_maintenance.py` | 3 | `sync-schema` only |

### Final State: **116/116 tests passing, 0 deprecation warnings**

---

## Phase 2 — Deep Audit

### Scoring

| Dimension | Score | Key Strengths | Key Weaknesses |
|-----------|-------|---------------|----------------|
| **Security** | **6/10** | CSRF double-submit, PII audit logging, HttpOnly cookies, access token expiry | Per-process rate limiter (multi-worker bypass), no account lockout, no CSP/HSTS headers, IDOR on `/session/{user_id}`, PII in error messages and query strings |
| **Performance** | **5.5/10** | Async everywhere, hiredis for Redis, asyncpg driver | N+1 queries in `ParticipationPerSportService.list()` (3N queries), in-memory pagination on participant list, missing indexes on 15+ columns, no `pool_timeout` (hangs on exhaustion) |
| **Architecture** | **6/10** | Clean frontend ports & adapters, correct dependency direction, good module isolation | Services raise `HTTPException` (web coupling), `BaseService` ≈ `BaseRepository` (near-duplicate), V1==V2 (no actual versioning), `card_service` opens own DB session, broken migration chain |
| **Scalability** | **5/10** | Connection pooling configured, Redis available | In-memory rate limiter (per-process), in-memory pagination, N+1 queries, no queue/background tasks |
| **Maintainability** | **7/10** | Consistent frontend structure, good TypeScript patterns, readable backend | 680-line `participant_service.py`, empty `athlete_service.py`, misspelled `loggine.py`, no shared `BaseModel`, duplicate `id`/`created_at` across all models |

### Critical Findings (5)

| # | Area | Issue | Location |
|---|------|-------|----------|
| C1 | **Security** | Rate limiter per-process → 4 workers = 4× effective limit | `core/ratelimit.py:7-29` |
| C2 | **Architecture** | Migration chain broken — missing revision file | `alembic/` |
| C3 | **Security** | No CSP, HSTS, XFO, or any security headers | `frontend/next.config.ts` |
| C4 | **Security** | Auth proxy logic orphaned (no `middleware.ts`) | `frontend/proxy.ts` |
| C5 | **Performance** | No code splitting — portal layout loads all pages eagerly | `frontend/` entire app |

### High Findings (10)

| # | Area | Issue | Location |
|---|------|-------|----------|
| H1 | **Security** | IDOR: any auth'd user views any user's session | `auth.py:107-126` |
| H2 | **Security** | PII leaked in 500 error messages (3 sites) | `participant_service.py:78,397,516` |
| H3 | **Security** | `except Exception` swallows errors silently | `deps.py:47-48` |
| H4 | **Security** | Token hash mismatch not alerted/revoked | `auth_service.py:172-175` |
| H5 | **Security** | PII in GET query strings → server logs | `participant.py:114-156` |
| H6 | **Arch** | V1==V2 (same prefix), root router registered twice | `src/api/main.py:25-26,36,90` |
| H7 | **Arch** | 5+ services raise `HTTPException` (web coupling) | `services/*.py` |
| H8 | **Arch** | Schema mutations via API, not migration | `maintenance.py:48-66` |
| H9 | **Arch** | No shared base model — `id`/`created_at` duplicated ×12 | `src/models/*` |
| H10 | **Arch** | `athlete_service.py` is empty (dead code) | `src/services/athlete_service.py` |

### Medium Findings (18)

| # | Area | Issue | Location |
|---|------|-------|----------|
| M1 | **Security** | Timing-based user enumeration on login | `auth_service.py:77-81` |
| M2 | **Security** | No rate limiting on refresh/logout | `auth.py:57-104` |
| M3 | **Security** | Cookie `secure` disabled in "local" env | `auth_service.py:38,53,62,70` |
| M4 | **Security** | No account lockout (IP-only) | `auth_service.py:75-111` |
| M5 | **Security** | LIKE injection via `%search%` | `participant_service.py:139,212` |
| M6 | **Security** | PII columns fetched in list queries (unused) | `participant_service.py:183-203` |
| M7 | **Security** | PII audit log written after data retrieval | `participant.py:206-216` |
| M8 | **Security** | Cloudinary `api_key` exposed to client | `frontend/cloudinary.ts:71` |
| M9 | **Security** | CSRF wired but never issued by backend | `frontend/headers.ts:44-46` |
| M10 | **Perf** | Missing `pg_trgm` indexes for ILIKE (5 cols) | `participant_service.py:213-221` |
| M11 | **Perf** | 7 scalar subqueries instead of aggregated pass | `dashboard_service.py:37-52` |
| M12 | **Perf** | No `pool_timeout` → hangs on exhaustion | `core/database.py:19-30` |
| M13 | **Perf** | No Redis reconnection/retry logic | `core/redis_client.py:17-25` |
| M14 | **Perf** | Missing `React.memo` on frequent re-renderers | `frontend/` multiple files |
| M15 | **Perf** | Single auth context causes broad re-renders | `frontend/AuthContext.tsx:88-206` |
| M16 | **Perf** | No `next/image` optimization for photos | `frontend/` multiple files |
| M17 | **Arch** | `BaseService` ≈ `BaseRepository` (near-duplicate) | `services/base.py` vs `database/base_repository.py` |
| M18 | **Arch** | `require_staff` allows FEDERATION + ADMIN + SUPER_ADMIN | `deps.py:67` |

---

## Phase 3 — System Architecture

### Dependency Flow (Frontend)

```
Page (app/(portal)/*/page.tsx)
  ↓
Module Component (modules/*/components/*.tsx)
  ↓
Module Hook (modules/*/hooks/*.ts)
  ↓
Module Port (modules/*/ports/I*Repository.ts)
  ↓
Module Adapter (modules/*/adapters/*HttpAdapter.ts) ← Zod parsing
  ↓
Module API (modules/*/api/index.ts)
  ↓
Core API Client (core/api/client.ts) ← Axios + refresh
  ↓
Next.js Proxy (next.config.ts) → /api/* → Backend
```

### Dependency Flow (Backend)

```
Route (src/api/v1/routes/*.py) ← Pydantic Schema (validation)
  ↓
Service (src/services/*.py)
  ↓
BaseRepository / Direct SQLAlchemy queries
  ↓
Models (src/models/*.py)
  ↓
Database (core/database.py + asyncpg)
```

**Violations found:**
- `card_service.py:22` — opens own `SessionLocal()` instead of injected `db`
- 5+ services raise `HTTPException` directly (web layer coupling)
- Inline business logic in `cloudinary.py`, `sports_events.py`, `dashboard.py`

---

## Recommended Roadmap

### 🔥 Quick Wins (1-2 days each)
1. **Fix per-process rate limiter** — use Redis-backed or shared state
2. **Add `middleware.ts` + security headers** to frontend
3. **Fix IDOR on `/session/{user_id}`** — check caller owns the user_id
4. **Stop PII in error messages** — generic 500s, log the real error
5. **Fix duplicate `remove_org_from_event_sport`** — delete second definition

### 📋 Short Term (1 week)
6. **Implement refresh token reuse detection** — family invalidation
7. **Add database indexes** — `pg_trgm` for search, composite indexes for joins
8. **Separate JWT signing keys** — access vs refresh
9. **Fix `card_service`** — use injected session
10. **Apply `React.memo`** to frequently re-rendering components

### 🏗️ Medium Term (1 month)
11. **Fix broken migration chain** — recover missing revision
12. **Fix in-memory pagination** — SQL-level pagination across UNION query
13. **Add Redis caching** — dashboard stats, reference data (5 min TTL)
14. **Eliminate dual caching in frontend** (custom cache + React Query)
15. **Add code splitting** — dynamic imports for heavy components

### 🚀 Long Term (3+ months)
16. **Implement Use Case layer** — formal business logic isolation
17. **Convert portal to Server Components** — extract interactive islands
18. **Add E2E test suite** — Playwright for auth, registration, review flows
19. **Structured logging** with correlation IDs (replace `print()` emoji logging)
20. **Pydantic v2 migration audit** — ensure all schemas use `model_config`

---

## Current Test Dashboard

```
Status: ✅ ALL PASSING
Total:  116 tests
Warnings: 0
Files:  13 test files across 5 domains
Coverage gap: card, cloudinary routers (excluded by design)
```
