# Full System Audit — MOEYS

**Role:** Principal Software Architect / Principal Security Engineer / Senior FastAPI & Next.js Engineer / Database Performance Engineer / DevOps Engineer

**Goal:** Audit, score, and roadmap — no code changes unless explicitly stated.

---

## PHASE 1 — Architecture Discovery

### 1.1 Frontend Architecture

#### Directory Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (AuthProvider wrapper)
│   ├── (auth)/                   # Login page route group
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (portal)/                 # Protected pages route group
│   │   ├── layout.tsx            # Client Component — Sidebar + TopBar
│   │   ├── dashboard/page.tsx
│   │   ├── events/page.tsx
│   │   ├── sports/page.tsx
│   │   ├── register/page.tsx
│   │   ├── search/page.tsx
│   │   ├── users/page.tsx
│   │   ├── reports/page.tsx
│   │   └── cards/page.tsx
│   └── page.tsx                  # Root redirect
├── core/                         # Shared infrastructure
│   ├── api/
│   │   ├── client.ts             # Axios instance + refresh interceptor
│   │   ├── constants.ts          # API_BASE_URL, CSRF cookie/header names
│   │   ├── headers.ts            # Dynamic header setup (auth, CSRF)
│   │   ├── queryKeys.ts          # Centralized React Query key factory
│   │   └── referenceData.ts      # Dual-cached ref data (custom cache + RQ)
│   ├── auth/
│   │   ├── context/AuthContext.tsx # Single mega-context (user, state, actions)
│   │   ├── hooks/
│   │   │   ├── useRequireAuth.ts  # Redirects to login if unauthenticated
│   │   │   └── useRequireRole.ts  # Redirects if insufficient role
│   │   └── components/
│   │       └── ProtectedRoute.tsx  # Auth gate wrapper
│   ├── lib/
│   │   ├── upload/cloudinary.ts   # Cloudinary client-side upload
│   │   └── logger/logger.port.ts  # Structured logger port
│   └── styles/                    # Global styles
├── modules/                       # Feature modules (Ports & Adapters)
│   ├── auth/                      # Login form, auth UI
│   ├── dashboard/                 # Dashboard stats
│   ├── events/                    # Event management
│   ├── sports/                    # Sports management
│   ├── registration/              # Participant registration (largest module)
│   │   ├── api/index.ts           # HTTP calls
│   │   ├── hooks/
│   │   │   ├── useRegistrations.ts
│   │   │   ├── useCascadingData.ts
│   │   │   └── useCategories.ts
│   │   ├── ports/
│   │   │   └── IRegistrationRepository.ts
│   │   ├── adapters/
│   │   │   └── RegistrationHttpAdapter.ts
│   │   ├── schema/registration.schema.ts  # Zod validation
│   │   ├── components/            # Form steps, lists
│   │   └── store.ts              # Zustand store (filters, pagination)
│   ├── bynumber/                  # Search by number
│   ├── survey/                    # Survey module
│   ├── reports/                   # Reports & Excel export
│   ├── cards/                     # ID card generation
│   ├── users/                     # User management
│   └── common/                    # Sidebar, TopBar, shared UI
├── shared/                        # Reusable UI primitives
│   ├── ui/                        # DataTable, Modal, QueryBoundary, etc.
│   └── form/                      # TextInputField, SelectField, FileUploadField
├── next.config.ts
├── proxy.ts                       # Orphaned — supposed to be middleware.ts
├── env.ts                         # Environment variable definitions
└── .env.local                     # Dev defaults (http://localhost:8000)
```

#### Dependency Flow

```
Page (app/(portal)/*/page.tsx)
  ↓
Module Component (modules/*/components/*.tsx)
  ↓
Module Hook (modules/*/hooks/*.ts)
  ↓
Module Port Interface (modules/*/ports/I*Repository.ts)   ← Abstraction boundary
  ↓
Module Adapter (modules/*/adapters/*HttpAdapter.ts)       ← Zod parsing boundary
  ↓
Module API (modules/*/api/index.ts)
  ↓
Core API Client (core/api/client.ts)                      ← Axios + refresh interceptor
  ↓
Next.js Proxy (next.config.ts → rewrite) → /api/* → Backend
```

**Store Layer (side-channel):**
```
Module Store (Zustand) ← Filter state (search, page, sort)
              ↑
Module Component reads store directly (bypassing ports/adapters/hooks)
```

**Auth Layer (global):**
```
Root Layout → AuthProvider (context)
  ↓
ProtectedRoute ← useRequireAuth / useRequireRole
  ↓
Any module component ← useAuth() for user/role
```

**Dependency direction is correct** — pages depend on modules, modules depend on core infrastructure. No circular dependencies found. The ports & adapters pattern is authentic (not cosmetic): each module has a real `port/I*Repository.ts` interface and a real `adapters/*HttpAdapter.ts` implementation. The adapter is the Zod parsing boundary — malformed backend responses are caught there, not in components.

**Violations:**
- Zustand stores are read directly by components (skip ports/adapters/hooks) — modules/registration/store.ts is consumed inline in RegisterForm.tsx
- `useAuth()` from core/auth is consumed across all layers (acceptable for cross-cutting concern)

#### Component Hierarchy (Portal)

```
ProtectedRoute
└── Sidebar + TopBar
    └── Page Content
        ├── DataTable (shared)
        ├── Modal (shared)
        ├── Form Fields (shared)
        │   ├── TextInputField
        │   ├── SelectField
        │   ├── DatePickerField
        │   └── FileUploadField
        └── QueryBoundary (shared)
            ├── Loading spinner
            └── Error boundary
```

All portal pages are **Client Components** (`"use client"` at layout level). No Server Components exist inside `(portal)/`. The side effect: all page JS is bundled eagerly, no RSC streaming benefits.

---

### 1.2 Backend Architecture

#### Directory Structure

```
backend/
├── main.py                    # App entry: lifespan, middleware stack, CORS, Sentry
├── core/
│   ├── config.py              # Pydantic Settings (99 lines)
│   ├── database.py            # async engine, SessionLocal, Base (32 lines)
│   ├── security.py            # bcrypt hashing, JWT create/decode (82 lines)
│   ├── csrf.py                # Double-submit cookie CSRF middleware (66 lines)
│   ├── cache.py               # Redis get/set/delete with fallback (78 lines)
│   ├── redis_client.py        # Connection pool + get_redis() (28 lines)
│   ├── ratelimit.py           # In-memory sliding window per-process (33 lines)
│   ├── loggine.py             # Request logging middleware (misspelled name)
│   └── cache_control.py       # Cache-Control header middleware (27 lines)
├── src/
│   ├── api/
│   │   ├── main.py            # Router aggregation (v1 + v2, auth deps)
│   │   └── v1/routes/
│   │       ├── auth.py        # Login, refresh, logout, session
│   │       ├── events.py      # Event CRUD + sport/org associations
│   │       ├── sports.py      # Sport CRUD + categories
│   │       ├── organization.py
│   │       ├── participant.py # Participant CRUD + PII reveal
│   │       ├── users.py       # User management (superadmin only)
│   │       ├── dashboard.py   # Stats aggregation
│   │       ├── public.py      # Public events/sports (no auth)
│   │       ├── excel.py       # Excel export endpoints
│   │       ├── sports_events.py
│   │       ├── participation_per_sport.py
│   │       ├── maintenance.py # sync-schema / drop (local only)
│   │       ├── card.py        # ID card data (planned reimplementation)
│   │       └── cloudinary.py  # Upload signing (planned reimplementation)
│   ├── services/
│   │   ├── auth_service.py       # Token management, cookies (207 lines)
│   │   ├── events_service.py     # Event CRUD + associations (231 lines)
│   │   ├── sports_service.py     # Sport CRUD + categories
│   │   ├── organization_service.py
│   │   ├── participant_service.py # Participant CRUD (680 lines — monolithic)
│   │   ├── dashboard_service.py  # Stats aggregation (module-level functions)
│   │   ├── card_service.py       # Opens own DB session (!) (191 lines)
│   │   ├── excel_service.py      # Sequential independent queries
│   │   ├── user_service.py
│   │   ├── participation_per_sport_service.py
│   │   ├── athlete_service.py    # EMPTY FILE (dead code)
│   │   ├── base.py               # BaseService — near-duplicate of BaseRepository
│   │   └── __init__.py           # Empty
│   ├── schemas/
│   │   ├── auth.py, event.py, sport.py, org.py, enroll.py
│   │   ├── athlete.py, leader.py, registration.py
│   │   ├── participation_per_sport.py, sports_event.py
│   │   ├── user.py, dashboard.py, excel.py
│   │   └── __init__.py           # Incomplete re-exports
│   ├── models/
│   │   ├── base.py               # DOES NOT EXIST (no shared base)
│   │   ├── user.py               # User + UserRole enum
│   │   ├── events.py             # Events model (plural class name)
│   │   ├── athletes.py           # athletes class (lowercase!)
│   │   ├── leader.py             # leader class (lowercase!)
│   │   ├── category.py           # category class (lowercase!)
│   │   ├── enrollment.py         # Enroll class (proper PascalCase)
│   │   ├── refresh_token.py
│   │   ├── pii_access_log.py
│   │   └── enum/                 # Split enums across 3 files
│   ├── database/
│   │   ├── deps.py               # Auth deps (get_current_user, role checkers, org scoping)
│   │   ├── base_repository.py    # Generic CRUD (60 lines)
│   │   └── queries/              # Query classes
│   └── exceptions/
│       └── participation.py      # ParticipationReviewError (domain exception pattern)
├── alembic/                      # Broken migration chain (missing revision)
├── tests/
│   ├── conftest.py               # Fixtures: client, auth clients, rate limiter reset
│   └── api/
│       ├── test_events.py
│       ├── test_organization.py
│       ├── test_participant.py
│       ├── test_dashboard.py
│       ├── test_sports.py
│       ├── test_public.py
│       ├── test_auth.py
│       ├── test_users.py         # 15 tests (added)
│       ├── test_excel.py         # 6 tests (added)
│       ├── test_participation_per_sport.py  # 15 tests (added)
│       ├── test_sports_events.py # 9 tests (added)
│       └── test_maintenance.py   # 3 tests (added)
└── pyproject.toml
```

#### Dependency Flow

```
Route (src/api/v1/routes/*.py)
  │  ← Pydantic Schema (request validation on input)
  │  ← Pydantic Schema (response serialization on output)
  ↓
Service (src/services/*.py)
  │  ← Domain Exceptions (src/exceptions/)
  │  ← Service-level DTOs (optional, not consistently used)
  ↓
BaseRepository / Direct SQLAlchemy queries
  │
  ├── src/database/base_repository.py  (generic CRUD — used by UserService, OrganizationService)
  └── src/database/queries/*.py        (domain-specific queries — used by ParticipantService)
  ↓
Models (src/models/*.py) ← SQLAlchemy ORM models
  ↓
Core Database (core/database.py → asyncpg → PostgreSQL)
```

**Auth Dependency Chain (cross-cutting):**
```
Route ← Depends(get_current_user)
         Depends(require_admin / require_superadmin / require_staff)
         Depends(enforce_org_access)
              ↓
         src/database/deps.py
              ↓
         core/security.py (JWT decode)
         src/models/user.py (DB lookup)
```

**Dependency direction is correct** — routes depend on services, services depend on repositories/models, models depend on core database. No circular imports found.

**Violations:**
- `card_service.py:22` opens `SessionLocal()` directly — bypasses FastAPI DI and connection lifecycle
- 5+ services raise `HTTPException` directly (web layer coupling in domain layer)
- `src/database/deps.py` raises `HTTPException` (web coupling in data access layer)
- `BaseService` (42 lines) and `BaseRepository` (60 lines) are near-duplicates — only `create` differs
- `athlete_service.py` is completely empty

#### Authentication Flow

```
POST /api/login
  1. Rate limiter check (in-memory, per-IP, 5/60s)
  2. Validate credentials → bcrypt verify
  3. Generate access_token (30min) + refresh_token (14d)
  4. Set CSRF token cookie (JS-readable, SameSite=Lax)
  5. Set access_token cookie (HttpOnly, Secure, SameSite=Lax, Path=/api)
  6. Set refresh_token cookie (HttpOnly, Secure, SameSite=Strict, Path=/api/auth/refresh)
  7. Store refresh token hash + jti in DB
  8. Return { "detail": "Authenticated successfully" }

POST /api/refresh
  1. Read refresh_token cookie
  2. Verify JWT signature
  3. Look up token hash in DB
  4. Check revoked flag + token_valid_from
  5. Rotate: delete old token, issue new pair
  6. Set new cookies

POST /api/logout
  1. Revoke refresh token in DB
  2. Clear all cookies

GET /api/session/{user_id}
  1. Authenticate via access_token cookie
  2. Return user profile (NO ownership check — IDOR)
```

---

## PHASE 2 — Security Audit

### Scoring: **6/10**

---

### 2.1 Authentication

| Issue | Severity | File:Line | Detail |
|-------|----------|-----------|--------|
| Per-process rate limiter | **CRITICAL** | `core/ratelimit.py:7-29` | In-memory `defaultdict` per process. With `uvicorn --workers 4`, effective limit = 20 req/60s instead of 5. Completely defeats brute-force protection. |
| No account lockout | **HIGH** | `auth_service.py:75-111` | IP-based rate limiter is the only brute-force defense. An attacker with a botnet (multiple IPs) can try unlimited passwords. No progressive delay, no CAPTCHA, no lockout after N failures. |
| Timing-based user enumeration | **MEDIUM** | `auth_service.py:77-81` | Short-circuit: non-existent user = 1 DB query (fast), existing user = 1 DB + bcrypt verify (slow, ~200ms). Timing difference reveals which usernames are registered. |
| No rate limiting on refresh/logout | **MEDIUM** | `auth.py:57-104` | Only `/login` is rate-limited. `/refresh` can be called unlimited times — an attacker with a stolen refresh token can rotate indefinitely. `/logout` can be used for DoS. |
| JWT missing `aud`/`iss` claims | **LOW** | `security.py:35-44` | Tokens have no audience or issuer. If the same secret is reused across services (not currently the case), a token from one service would be valid for all. |
| Dual-secret fallback in decode | **LOW** | `security.py:69-74` | `decode_token` tries access secret, then refresh secret. An access token signed with refresh secret (or vice versa) would still decode, reducing isolation between token types. |
| Weak bcrypt cost (default 12) | **LOW** | `security.py:11` | For a government system processing PII, cost factor 13-15 is recommended. Default 12 from passlib is adequate but not enterprise-grade. |

### 2.2 Authorization

| Issue | Severity | File:Line | Detail |
|-------|----------|-----------|--------|
| IDOR on `/session/{user_id}` | **HIGH** | `auth.py:107-126` | Any authenticated user can view ANY other user's profile by UUID. `get_current_user` proves authentication but not ownership. No admin check either. |
| `except Exception` swallows all errors | **HIGH** | `deps.py:47-48` | `except Exception: raise HTTPException(401)` catches DB errors, type errors, UUID parsing failures. Real errors are masked from operators. No logging of underlying exception. |
| Access token revocation is all-or-nothing | **MEDIUM** | `deps.py:39-44` | `token_valid_from` invalidates ALL access tokens at once. No per-JTI access token revocation. Compromised single access token forces full re-authentication. |
| Dashboard leaks across orgs | **MEDIUM** | `dashboard_service.py:111-118` | `get_dashboard_recent_enrollments` has no `org_id` filter — org-scoped users see enrollments from ALL organizations. Only stats and top_orgs are scoped. |
| `require_staff` allows broad roles | **LOW** | `deps.py:67` | `require_staff` allows FEDERATION + ADMIN + SUPER_ADMIN. The inverted logic (`not ORGANIZATION`) means adding a new role could inadvertently grant staff access. |

### 2.3 Input Validation

| Issue | Severity | File:Line | Detail |
|-------|----------|-----------|--------|
| PII leaked in 500 error messages | **HIGH** | `participant_service.py:78,397,516` | `raise HTTPException(500, detail=f"Registration failed: {str(e)}")` — exception string may contain DB values, file paths, or PII. Three instances. |
| LIKE search bypass | **MEDIUM** | `participant_service.py:139,212` | `term = f"%{params.search}%"` then `ilike(term)`. SQLAlchemy prevents SQL injection, but special LIKE chars (`%`, `_`) can be abused: searching `%` returns all records. |
| `create_participant` accepts raw `dict` | **MEDIUM** | `participant.py:41` | `payload: dict = Body(...)` manually constructs `FullRegistrationRequest`. Bypasses FastAPI's automatic validation on the route handler level. |
| No server-side file type validation | **MEDIUM** | (inferred) | Document URLs are stored as-is. No validation that uploaded files are valid images/PDFs or that URLs point to application-controlled storage. |
| No XSS sanitization on string fields | **MEDIUM** | All string fields | Names, addresses stored without sanitization. If rendered unsafely in frontend, stored XSS is possible. |

### 2.4 Web Security

| Issue | Severity | File:Line | Detail |
|-------|----------|-----------|--------|
| No CSP, HSTS, XFO, or security headers | **CRITICAL** | `frontend/next.config.ts` | Zero security headers configured. No Content-Security-Policy, no Strict-Transport-Security, no X-Frame-Options, no X-Content-Type-Options. |
| No `middleware.ts` — proxy logic orphaned | **HIGH** | `frontend/proxy.ts` | Auth guard logic exists in `proxy.ts` but Next.js never reads it (must be `middleware.ts`). Route-based auth is not enforced server-side — only client-side via `ProtectedRoute`. |
| CSRF non-functional in frontend | **MEDIUM** | `frontend/headers.ts:44-46` | Frontend reads `csrf_token` cookie and sets `X-CSRF-Token` header, but the cookie is never issued by the backend. Comment confirms: "Until the backend issues the CSRF cookie this is a no-op." |
| Cloudinary `api_key` exposed to client | **MEDIUM** | `frontend/cloudinary.ts:71` | `api_key` sent in FormData to Cloudinary's public upload endpoint. An attacker could use this key for other Cloudinary API operations. |
| CSRF cookie is JS-readable | **MEDIUM** | `auth_service.py:53` | Required by double-submit pattern, but any XSS instantly defeats CSRF protection because the attacker can read `csrf_token` from cookies. |
| HTTP fallbacks in defaults | **MEDIUM** | Multiple `.env` files | `http://localhost:8000` is the default API URL. If `NEXT_PUBLIC_API_URL` is unset in production, credentials travel in cleartext. |
| CORS allows `*` methods/headers | **LOW** | `main.py:54-55` | `allow_methods=["*"]` and `allow_headers=["*"]` in production. Should be restricted to known values. |
| Auth routes CSRF-exempt | **LOW** | `csrf.py:39-44` | Login/refresh/logout are CSRF-exempt. A CSRF logout attack can terminate a user's session. |
| `window.location.href` instead of router | **LOW** | `frontend/RegisterForm.tsx:121` | Full page reload after registration loses all React state. Potential open redirect vector. |

### 2.5 Sensitive Data

| Issue | Severity | File:Line | Detail |
|-------|----------|-----------|--------|
| PII in GET query strings | **HIGH** | `participant.py:114-156` | `search` parameter accepts names/phone numbers. Appears in: server access logs, browser history, Referer headers, proxy/CDN logs. |
| PII columns fetched unnecessarily in list queries | **MEDIUM** | `participant_service.py:183-203` | SELECT includes phone, DOB, document URLs even for list views. `_format_list_row` discards them, but data is fetched from DB and held in memory. |
| PII audit log written after data retrieval | **MEDIUM** | `participant.py:206-216` | PII value is fetched before the audit log is committed. If DB write fails, access is unlogged. |
| `localStorage` for UI state | **LOW** | `frontend/Sidebar.tsx:67-81` | Sidebar collapse state persists in `localStorage`. Not PII but `localStorage` is readable by any JS on the origin. |
| Error boundary leaks messages | **LOW** | `frontend/QueryBoundary.tsx:45` | `this.state.error?.message` rendered directly. Can leak internal implementation details. Security docs explicitly forbid this. |

**Positive findings:**
- PII access logs capture WHO accessed WHAT field WHEN but never the value
- Data minimization in list views (phone/DOB/docs omitted from list response)
- React Query `gcTime: 0` and `staleTime: 0` for PII endpoints
- `queryClient.clear()` on logout
- Logger port enforces `string | number | boolean | undefined` only

### 2.6 OWASP Top 10 Mapping

| OWASP Category | Status | Key Issues |
|----------------|--------|------------|
| **A01: Broken Access Control** | ⚠️ HIGH | IDOR on `/session/{user_id}`, dashboard cross-org leak, no ownership check on session |
| **A02: Cryptographic Failures** | ⚠️ MEDIUM | Same key for access/refresh tokens, weak bcrypt cost (12), no access token per-JTI revocation |
| **A03: Injection** | ✅ LOW | SQLAlchemy parameterizes queries. LIKE search has bypass risk but no SQL injection. |
| **A04: Insecure Design** | ⚠️ HIGH | Per-process rate limiter, no account lockout, no security headers, no middleware auth |
| **A05: Security Misconfiguration** | ⚠️ MEDIUM | CORS `["*"]`, debug emoji logging, HTTP fallback defaults, no CSP/HSTS |
| **A06: Vulnerable Components** | ⚠️ LOW | bcrypt pinned at 4.0.1 (older). Full dependency audit needed. |
| **A07: Identification & Auth Failures** | 🔴 CRITICAL | Per-process rate limiter defeats brute-force protection with multiple workers |
| **A08: Data Integrity Failures** | ✅ MEDIUM | CSRF double-submit well implemented. JWTs signed. Refresh token rotation exists. |
| **A09: Security Logging & Monitoring** | ✅ MEDIUM | PII access logs are thorough. Sentry configured. No centralized log aggregation. |
| **A10: SSRF** | ✅ LOW | No server-side request forgery vectors found. |

---

## PHASE 3 — Backend Performance Audit

### Scoring: **5.5/10**

---

### 3.1 Database

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| N+1 in `ParticipationPerSportService.list()` | **CRITICAL** | `participation_per_sport_service.py:167-187` | Per item: 1 query for org + 1 for seo + 1 for event = **3N queries**. With 100 items = 301 DB round-trips. Should use JOIN. |
| In-memory pagination on participant list | **HIGH** | `participant_service.py:147-164` | Fetches ALL athletes + ALL leaders matching filters, merges in Python, sorts, then paginates in memory. With 50K participants this will OOM or hang. |
| N+1 in `ExcelService` | **HIGH** | `excel_service.py:110-203` | Per sport: 1 query for athletes + 1 for leaders = 2N queries + 1 for sports list. 20 sports = 41 queries. |
| N+1 in `ParticipationPerSportService.get()` | **HIGH** | `participation_per_sport_service.py:67-92` | 1 query for item + 1 for org + 1 for seo + 1 for event = 4 queries for a single record. |
| Missing `pg_trgm` indexes for ILIKE search | **HIGH** | `participant_service.py:213-221` | `%term%` wildcard prefix makes B-tree indexes useless. 5 columns searched: en_family_name, en_given_name, kh_family_name, kh_given_name, phonenumber. All full table scans. |
| 7 scalar subqueries instead of 1 aggregated pass | **MEDIUM** | `dashboard_service.py:37-52` | 7 independent COUNT subqueries in one SELECT when `org_id` is set. Each requires a separate table/index scan. Use `COUNT(*) FILTER(WHERE ...)`. |
| Missing composite indexes on join columns | **MEDIUM** | Multiple models | `athlete_participation`, `leader_participation`, `sports_event_org` filtered on `(events_id, sports_id, organization_id)` but lack composite indexes. |
| `card_service.py` opens own DB session | **MEDIUM** | `card_service.py:22` | `async with SessionLocal() as session:` — bypasses FastAPI DI, transaction management, and connection pooling. Untestable with mock sessions. |
| `leader_roles` filter defeats index | **MEDIUM** | `participant_service.py:255-261` | `func.lower(cast(Leader.LeaderRole, Text)).in_(role_values)` — wrapping column in LOWER(CAST(...)) makes any index useless. Needs expression index. |
| Dashboard queries always global for events/sports | **MEDIUM** | `dashboard_service.py:55-66` | No org_id filter on recent enrollments. No pagination beyond limit 10. Fine for small data, degrades with growth. |
| Potential deadlock from different lock orders | **LOW** | `participant_service.py:351-517` | `update_participant` locks: Enroll → Athlete → Leader. `delete_participant` locks: Enroll → Athlete → LeaderParticipation → Leader. Different order can deadlock. |
| Race condition in `update_participant` | **LOW** | `participant_service.py:351-398` | No optimistic/pessimistic locking. Two concurrent updates cause last-write-wins. |

### 3.2 Connection Pool

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| No `pool_timeout` | **HIGH** | `core/database.py:19-30` | Missing `pool_timeout` means the application blocks **indefinitely** when pool is exhausted. With `pool_size=10` + `max_overflow=20`, a burst of 31 slow queries hangs every subsequent request forever. |
| `statement_cache_size=0` | **MEDIUM** | `core/database.py:27` | Disables prepared statement caching. Every query incurs full prepare-then-execute cycle. A small cache (256-512) would give ~1-2ms savings per query. |
| No connection warmup on startup | **LOW** | `main.py:28-30` | Lifespan only closes Redis. First request pays cost of establishing first DB connection from empty pool. |
| No engine disposal on shutdown | **LOW** | `main.py:28-30` | `engine.dispose()` not called on shutdown. Connections may linger until kernel timeout. |

### 3.3 Redis / Caching

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| No local fallback cache when Redis is down | **MEDIUM** | `core/cache.py:16-25` | When Redis is unavailable, every request hits the database. No in-memory TTL cache (e.g., `cachetools.TTLCache`) for hot keys. |
| Redis client recreated per call | **LOW** | `core/cache.py:16,29,39,49` | Every cache operation calls `get_redis()` which creates a new `Redis()` wrapper. Should be cached at module level. |
| Cache stampede race condition | **MEDIUM** | `core/cache.py:64-74` | Two concurrent requests for the same uncached key both compute and set. Use `redis.setnx` for atomic "set if not exists." |
| No socket timeouts on Redis | **MEDIUM** | `core/redis_client.py:18-22` | No `socket_connect_timeout`, `socket_timeout`, or `retry_on_timeout`. A Redis network partition can hang the first cache operation indefinitely. |
| `max_connections=20` hardcoded | **LOW** | `core/redis_client.py:20` | Should be configurable via settings. |
| No reconnection/retry logic | **LOW** | `core/redis_client.py:17-25` | On any Redis error, `get_redis()` returns `None` and cache degrades to DB. No health-check loop to detect Redis recovery. |

### 3.4 API / Routes

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| `count` is `len(rows)` not real COUNT | **MEDIUM** | `sports.py:43`, `events.py:97`, `org.py:68`, `users.py:54` | Returns only current page count, not total matching records. Frontend cannot compute pagination metadata. Only `participant_service.py` does a real `COUNT(*)`. |
| Unpaginated endpoints | **MEDIUM** | `events.py:242,334,356,412`, `sports.py:62` | `GET /events/{id}/sports`, `GET /events/{id}/sports/{id}/orgs`, etc. have no skip/limit. Returns all rows for large datasets. |
| Dashboard returns 6 parallel queries | **INFO** | `dashboard.py:36` | Using `asyncio.gather` on same `AsyncSession` is dangerous — asyncpg forbids concurrent operations on a single connection. Already fixed by serializing. |
| Excel endpoints don't stream | **LOW** | `excel_service.py` | Loads all data into memory, then returns as JSON. For orgs with 1000+ participants across 20+ sports, memory spikes. |

### 3.5 Services

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| Double commit in `ParticipationPerSportService.create()` | **LOW** | `participation_per_sport_service.py:53,65` | Two `commit()` calls + two `refresh()` calls = 4 round-trips for one logical operation. Single flush + commit would cut in half. |
| Redundant post-update SELECT | **LOW** | `participation_per_sport_service.py:114-116,154-156` | `commit()` + `refresh()` already gives current state, then calls `self.get(id)` for another SELECT. Redundant. |
| Sequential independent queries | **LOW** | `excel_service.py:12-61`, `participant_service.py:463-517` | Multiple independent SELECTs that could be parallelized with `asyncio.gather()`. |

---

## PHASE 4 — Frontend Performance Audit

### Scoring: **6/10**

---

### 4.1 Next.js

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| All portal pages are Client Components | **HIGH** | `app/(portal)/layout.tsx:1` | `"use client"` at the portal layout level means every nested page is a Client Component. No RSC streaming, no server-side data fetching, larger bundles. |
| No dynamic imports / code splitting | **HIGH** | Entire app | No `next/dynamic`, no `React.lazy`. All 14 portal page components, all shared UI, all form components bundled eagerly. |
| No `middleware.ts` for server-side auth | **MEDIUM** | `proxy.ts` (orphaned) | Client-side `ProtectedRoute` is the only auth guard. Server-side routing is unaware of auth state. Flash of unprotected content on every protected route. |
| Fallback HTTP URLs throughout | **MEDIUM** | Multiple config files | If env vars are unset in production, app silently falls back to `http://localhost:8000`. No production URL validation. |

### 4.2 React

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| Single auth context causes broad re-renders | **MEDIUM** | `core/auth/context/AuthContext.tsx:88-206` | Merged context: user, role, isAuthenticated, isLoading, error + all methods. Any state change (e.g., loading→ready) triggers re-render in EVERY consumer across the entire app tree. |
| Missing `React.memo` on frequently re-rendered components | **MEDIUM** | `FileUploadField.tsx`, `SelectField.tsx`, `RegisterForm.tsx`, `Sidebar.tsx`, `TopBar.tsx` | Form fields re-render on every parent re-render (step change, validation, data load). Only `DataTable` uses `React.memo`. |
| No lazy loading for images | **MEDIUM** | Multiple files | User photos from Cloudinary rendered with `<img>`, no `loading="lazy"`. Lists load all images immediately. |
| No `next/image` optimization for user photos | **MEDIUM** | Multiple files | Images served without Next.js Image Optimization — no `srcset`, no WebP/AVIF, no responsive sizes. |
| Redundant cascading data queries | **LOW** | `useCascadingData.ts:5-11` | `loadCascadingData()` fires 3 GETs every time registration form mounts. Different modules (events, bynumber, survey) independently fetch same ref data. |

### 4.3 React Query

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| Dual caching (custom cache + React Query) | **MEDIUM** | `core/api/referenceData.ts` | Reference data uses a custom in-memory cache (5 min TTL) AND React Query simultaneously. Two sources of truth, stale data risk, wasteful. |
| Query keys not granular enough | **MEDIUM** | `queryKeys.ts` | Keys like `['registrations']` and `['registrations', filter]` mean invalidating `['registrations']` wipes ALL registration queries. |
| Inconsistent query key patterns | **LOW** | `useCategories.ts:6` | `useCategories` defines key inline as `['categories', eventId, sportId]` instead of using central `queryKeys` registry. Cache invalidation across components is impossible. |
| PII data has `gcTime` default (5 min) | **LOW** | Registration hooks | `gcTime` defaults to 5 minutes, keeping PII in memory for 5 minutes after component unmounts. Should be `gcTime: 0`. |
| No optimistic updates on mutations | **LOW** | All mutation hooks | All mutations invalidate and refetch instead of optimistically updating cache. Causes visual flickering on every mutation. |

### 4.4 Bundle / Network

| Issue | Impact | File:Line | Detail |
|-------|--------|-----------|--------|
| ~40 unique `lucide-react` icons bundled | **MEDIUM** | 69 import sites | Despite tree-shaking, 40+ unique icons at ~1-2KB gzipped each accounts for significant bundle weight. Sidebar alone imports 13 icons. |
| Duplicate reference data fetchers across modules | **MEDIUM** | events, bynumber, survey modules | Each module fetches its own reference data. Network overhead from duplicate requests. |
| No request deduplication | **LOW** | `core/referenceData.ts` | Multiple components mounting simultaneously each trigger separate fetches despite the in-memory cache (race condition on cache miss). |
| Google Fonts without preconnect hints | **LOW** | `app/layout.tsx:11-23` | Two fonts (Kantumruy_Pro 5 weights, Work_Sans 4 weights) loaded without `<link rel="preconnect">` hints. FOIT on slow connections. |

---

## PHASE 5 — Architecture Maturity Review

### Architecture Type: **Hybrid — Clean/Hexagonal Frontend + Layered Backend**

| Dimension | Score | Assessment |
|-----------|-------|------------|
| **Frontend Architecture** | 8/10 | Genuine Ports & Adapters pattern. Each module has real port interfaces and adapter implementations. Dependency direction is correct. Zustand store is the only layer violation. |
| **Backend Architecture** | 6/10 | Clear layering but with violations (HTTPExceptions in services, card_service bypasses DI, BaseService ≈ BaseRepository). Missing Use Case layer. Incomplete migration from monolithic services. |

### 5.1 Layer Violations

| Violation | Severity | File | Detail |
|-----------|----------|------|--------|
| Card service opens own DB session | **HIGH** | `card_service.py:22` | `async with SessionLocal() as session:` — bypasses FastAPI DI. Cannot be tested with mock sessions. Circumvents connection pooling. |
| 5+ services raise `HTTPException` | **HIGH** | `participant_service.py`, `events_service.py`, `sports_service.py`, `auth_service.py` | Services return HTTP-layer exceptions. Should raise domain exceptions caught by exception handler. Only `participation_per_sport_service.py` uses the correct domain exception pattern. |
| Auth deps raise `HTTPException` | **MEDIUM** | `src/database/deps.py:82-118` | `get_effective_org_id` and `enforce_org_access` live in `database/` but raise web-layer exceptions. |
| Duplicate method | **MEDIUM** | `events_service.py:194-198` | `remove_org_from_event_sport` defined twice. Second definition silently shadows the first. |
| Duplicate business logic | **MEDIUM** | `sports_service.py:93-96` vs `events_service.py:92` | `add_sport_to_event` implemented in both services. Two services managing the same association. |
| Inline business logic in routes | **MEDIUM** | `cloudinary.py:34-51`, `sports_events.py:31-43` | Cloudinary signing and response building in route handlers, not services. |
| PII audit logic in route handler | **LOW** | `participant.py:208-216` | `PiiAccessLog` creation is in the route handler, not the service. Every route that reveals PII must duplicate this. |

### 5.2 Missing Abstractions

| Missing Abstraction | Impact | Justification |
|---------------------|--------|---------------|
| **No IUnitOfWork** | HIGH | Transactions managed ad-hoc with `flush()`/`commit()`/`rollback()` in each service. No atomic boundary for multi-repository operations. |
| **No Use Case layer** | HIGH | Services are CRUD wrappers. No `RegisterAthleteUseCase`, `SubmitParticipationUseCase`, etc. Business rules embedded in service methods. |
| **No shared BaseModel** | MEDIUM | Every model defines `id` and `created_at` independently. 12 models duplicate ~6 lines each. Inconsistent type annotations. |
| **No DI container** | MEDIUM | Services instantiated manually (`service = ParticipantService(db)`) in every route handler. Two DI patterns coexist (factory functions vs inline instantiation). |
| **No IClock** | LOW | `datetime.now(timezone.utc)` called directly everywhere. Time-dependent logic is untestable. |
| **No QueryBus / Specification** | LOW | Queries built inline with raw SQLAlchemy. No reusable query objects. |

### 5.3 Naming & Consistency

| Issue | Severity | Detail |
|-------|----------|--------|
| Inconsistent model naming | **MEDIUM** | `User` (PascalCase), `Events` (PascalCase, plural), `athletes` (snake_case), `leader` (snake_case), `category` (snake_case). Some are classes, some appear to be modules aliased as classes. |
| `loggine.py` misspelled | **LOW** | Module named `loggine` instead of `logging`. Should be `request_logging.py` for clarity. |
| `BaseService` ≈ `BaseRepository` | **MEDIUM** | Nearly identical CRUD methods. `BaseRepository` has `create`. `BaseService` lacks `create`. Both unused or inconsistently used. |
| `athlete_service.py` empty | **LOW** | Dead code from incomplete refactor. |
| `src/schemas/__init__.py` incomplete | **LOW** | Only exports a subset of schemas. Some routes import from `__init__`, others import directly from schema files. Inconsistent import paths. |

### 5.4 Testability

| Concern | Impact | Detail |
|---------|--------|--------|
| Global `settings` singleton | **MEDIUM** | `settings: Settings = Settings()` at module import in `config.py:98`. Cannot be mocked without monkey-patching or reloading module. |
| Global Redis `_pool` | **MEDIUM** | Module-level variable in `redis_client.py:11`. Tests must manage pool state across cases. |
| Global `login_limiter` | **LOW** | Module-level instance in `ratelimit.py:33`. Tests must reset it between cases (already done via fixture). |
| Inline `os.getenv()` calls | **MEDIUM** | `cloudinary.py:35-37` uses `os.getenv()` directly, bypassing settings. Untestable without env manipulation. |
| Card service bypasses DI | **HIGH** | `card_service.py` opens its own session. Cannot inject mock session for testing. |

---

## PHASE 6 — Roadmap

### Overall Scores

| Dimension | Score |
|-----------|-------|
| **Architecture** | 6.5/10 |
| **Security** | 6/10 |
| **Performance** | 5.5/10 |
| **Scalability** | 5/10 |
| **Maintainability** | 7/10 |

---

### 🔥 Quick Wins (1-2 days each)

#### 1. Fix per-process rate limiter

**Why:** Completely defeats brute-force protection when running multiple workers.
**Risk:** Low. Replace in-memory dict with Redis-backed counter.
**Complexity:** Low (30 lines).
**Expected Gain:** Restores actual rate limiting. Prevents credential stuffing.
**Example:**
```python
# core/ratelimit.py
async def check_rate_limit(self, key: str, max_requests: int, window: int) -> bool:
    redis = await get_redis()
    if redis is None:
        return True  # fail open (acceptable for local dev)
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, window)
    return current <= max_requests
```

#### 2. Add `middleware.ts` + security headers to frontend

**Why:** No server-side auth enforcement. No CSP/HSTS/XFO. Critical for government system.
**Risk:** Medium. CSP needs testing with all inline styles/resources.
**Complexity:** Low (rename `proxy.ts` → `middleware.ts`, add headers config).
**Expected Gain:** Defense-in-depth against XSS, clickjacking, MITM. Server-side route protection.
**Example:**
```ts
// middleware.ts
export { default } from './proxy';
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

// next.config.ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' https:; style-src 'self' 'unsafe-inline'" },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }];
}
```

#### 3. Fix IDOR on `/session/{user_id}`

**Why:** Any authenticated user can view any other user's profile. Data governance violation.
**Risk:** Low. Add ownership check.
**Complexity:** Trivial (3 lines).
**Expected Gain:** Closes data leak.
**Example:**
```python
# auth.py:107
@router.get("/session/{user_id}")
async def get_session(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=403, detail="Access denied")
```

#### 4. Stop PII in error messages

**Why:** `str(e)` on exception returns DB values, file paths, or PII to the client. Three instances.
**Risk:** Minimal. Log the real error, return generic message.
**Complexity:** Trivial.
**Expected Gain:** Prevents PII leakage.
**Example:**
```python
# participant_service.py
try:
    ...
except Exception as e:
    logger.error(f"Registration failed: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Registration failed due to a server error.")
```

#### 5. Fix duplicate `remove_org_from_event_sport`

**Why:** Method defined twice — second definition silently shadows first. Logic bug waiting to happen.
**Risk:** None.
**Complexity:** Trivial (delete one definition).
**Expected Gain:** Eliminates potential silent logic error.

---

### 📋 Short Term (1 week)

#### 6. Implement refresh token reuse detection (family invalidation)

**Why:** If an attacker steals a refresh token, both the attacker and legitimate user can refresh until one uses the old token. But there's no family invalidation.
**Risk:** Medium. Changes auth flow. Must handle race conditions.
**Complexity:** Medium. Track `jti` family, invalidate entire family on reuse detection.
**Expected Gain:** Stops refresh token theft.
**Example:**
```python
# auth_service.py
if record.revoked:
    # Revoke ALL tokens for this user — token reuse detected
    await self.db.execute(
        update(RefreshToken).where(
            RefreshToken.user_id == user_id
        ).values(revoked=True)
    )
    await self.db.commit()
    raise HTTPException(status_code=401, detail="Session revoked — please log in again")
```

#### 7. Add database indexes

**Why:** Missing indexes on 15+ columns cause full table scans on every search, filter, and join.
**Risk:** Very low. Add-only migration.
**Complexity:** Low.
**Expected Gain:** Dramatically improves search/filter/join performance.
**Example:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_enrollments_name_search ON enrollments USING gin (
    en_family_name gin_trgm_ops,
    en_given_name gin_trgm_ops,
    kh_family_name gin_trgm_ops,
    kh_given_name gin_trgm_ops
);
CREATE INDEX idx_enrollments_phonenumber ON enrollments USING gin (phonenumber gin_trgm_ops);
CREATE INDEX idx_athlete_participation_org_event ON athlete_participation (organization_id, events_id);
CREATE INDEX idx_participation_per_sport_org ON participation_per_sport (org_id);
CREATE INDEX idx_enrollments_created_at ON enrollments (created_at DESC);
```

#### 8. Separate JWT signing keys

**Why:** Access and refresh tokens share `JWT_SECRET_KEY`. If key leaks, both token types are forgeable.
**Risk:** Low. Add `JWT_REFRESH_SECRET_KEY` to settings. All existing tokens invalidated on deploy (acceptable for early stage).
**Complexity:** Low.
**Expected Gain:** Limits blast radius if one key is compromised.

#### 9. Fix `card_service` to use injected session

**Why:** Opens own `SessionLocal()`, bypassing FastAPI DI, connection pooling, and testability.
**Risk:** Low.
**Complexity:** Low (refactor to accept `db: AsyncSession` parameter).
**Expected Gain:** Testability, transaction consistency, proper connection lifecycle.

#### 10. Apply `React.memo` + separate auth contexts

**Why:** Every state change in auth context re-renders entire app tree. Form fields re-render on every parent change.
**Risk:** Low.
**Complexity:** Medium (split AuthContext into 3: user, state, actions).
**Expected Gain:** Reduces unnecessary re-renders. Improves form interaction responsiveness.

---

### 🏗️ Medium Term (1 month)

#### 11. Fix broken migration chain

**Why:** Missing revision file `4eba9d3a3fa9_initial_schema.py` means Alembic cannot run. All future schema changes are blocked.
**Risk:** Medium. Must reverse-engineer current schema state.
**Complexity:** High. Requires creating a squashed migration matching live schema.
**Expected Gain:** Safe, tracked, reversible schema changes.

#### 12. Fix in-memory pagination for participant list

**Why:** Fetches ALL matching records, merges in Python, then paginates. Will OOM with large datasets.
**Risk:** Medium. Changes query logic fundamentally.
**Complexity:** High. Requires SQL-level pagination across UNION query of athletes + leaders.
**Expected Gain:** Stable, predictable performance at any scale.

#### 13. Add Redis caching layer for dashboard + reference data

**Why:** Dashboard runs 7 queries on every page load. Reference data fetched redundantly.
**Risk:** Low (additive, no behavior change).
**Complexity:** Medium. Add `cache_or_compute` with stampede protection via `SET NX`.
**Expected Gain:** Dashboard loads 10-50x faster. DB load reduced significantly.
**Targets:**
- Dashboard stats (5 min TTL)
- Reference data: events list, sports list, org list (10 min TTL)
- Sport categories (5 min TTL)

#### 14. Eliminate dual caching in frontend

**Why:** `core/referenceData.ts` uses custom in-memory cache AND React Query. Two sources of truth, stale data risk.
**Risk:** Low.
**Complexity:** Medium. Remove custom cache, use React Query with `staleTime: 300000`.
**Expected Gain:** Single source of truth for server state.

#### 15. Add code splitting via dynamic imports

**Why:** All portal pages bundled eagerly. Heavy components like DataTable, charts, forms loaded on every page.
**Risk:** Low.
**Complexity:** Medium. Extract heavy components into `next/dynamic()` calls.
**Expected Gain:** 30-50% reduction in initial JS bundle. Faster page loads.

---

### 🚀 Long Term (3+ months)

#### 16. Implement formal Use Case layer

**Why:** Services are CRUD-heavy with business rules embedded. No single place to understand or audit business operations.
**Risk:** Medium. Major refactor.
**Complexity:** High.
**Expected Gain:** Maintainability, testability, business alignment.
**Example structure:**
```
src/
  use_cases/
    auth/
      LoginUseCase.py
      RefreshSessionUseCase.py
      LogoutUseCase.py
    registration/
      RegisterAthleteUseCase.py      # orchestrates Enroll + Athlete + Participation creation
      RegisterLeaderUseCase.py
      SearchParticipantsUseCase.py
      RevealPiiUseCase.py            # enforces audit logging before returning PII
    reporting/
      ExportEventReportUseCase.py
```

#### 17. Convert portal to Server Components with interactive islands

**Why:** All portal pages are Client Components. No RSC streaming, no server-side data fetching, larger bundles.
**Risk:** Medium. Requires careful extraction of interactive state.
**Complexity:** High. Must identify component boundaries, extract interactive islands.
**Expected Gain:** 30-50% JS bundle reduction. Faster initial page loads. Better SEO.

#### 18. Add E2E test suite (Playwright)

**Why:** 116 backend tests exist, zero E2E tests. Auth flow, registration flow, review workflow untested end-to-end.
**Risk:** Low (additive).
**Complexity:** High.
**Expected Gain:** Confidence for refactoring. Regression prevention.
**Target flows:**
- Login → dashboard redirect
- Registration → review → approval
- PII reveal flow
- Excel export

#### 19. Implement structured logging with correlation IDs

**Why:** Current `print()` with emoji in `loggine.py`. No structured fields, no searchability, no correlation IDs.
**Risk:** Low.
**Complexity:** Medium. Add structlog or python-json-logger.
**Expected Gain:** Log aggregation, debugging, audit trails, request tracing across services.

#### 20. Replace OSS bcrypt with libsodium (Argon2)

**Why:** Passlib's bcrypt is pinned at 4.0.1 (older). Argon2 is the OWASP-recommended password hashing algorithm (2015+). For a government system, modern KDF is appropriate.
**Risk:** Medium. All passwords must be re-hashed on next login.
**Complexity:** Medium. Add `pysodium` or `argon2-cffi`. Requires migration strategy for existing hashes.
**Expected Gain:** Future-proof password security. Resistance to GPU/ASIC cracking.

---

## Test Dashboard

```
Status: ✅ ALL PASSING

Total Tests:  116
Warnings:     0
Test Files:   13

Coverage:
  - events:                        15 tests
  - organization:                  10 tests
  - participant:                   10 tests
  - dashboard:                     5 tests
  - sports:                        4 tests
  - public:                        6 tests
  - auth:                          6 tests
  - users:                         15 tests (added)
  - excel:                         6 tests (added)
  - participation_per_sport:       15 tests (added)
  - sports_events:                 9 tests (added)
  - maintenance:                   3 tests (added)

Excluded:
  - card router (planned reimplementation)
  - cloudinary router (planned reimplementation)
```
