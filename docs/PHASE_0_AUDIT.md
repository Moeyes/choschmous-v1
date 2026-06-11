# COMPREHENSIVE SYSTEM AUDIT REPORT

## Architecture Score: **6.5/10**
- Strong frontend module isolation (+) but missing Server Components (-)
- Backend has clean layering but with violations (-)
- No formal domain model or use cases (-)

## Security Score: **6/10**
- Good CSRF, good cookie security, good PII handling (+)
- No rate limiting, no account lockout, missing security headers (-)
- Token reuse detection missing (-)

## Performance Score: **5.5/10**
- Frontend mostly well-optimized (+)
- Critical N+1 queries in participation_per_sport (-)
- In-memory pagination for participant list (-)
- No database indexes on critical search columns (-)

## Scalability Score: **5/10**
- No caching layer (Redis) (-)
- In-memory pagination won't scale (-)
- N+1 queries explode with data growth (-)
- No queue / background task for report generation (-)

## Maintainability Score: **7/10**
- Clean frontend module structure (+)
- Good TypeScript patterns (+)
- Backend has dead code and duplicates (-)
- No migrations tool (no Alembic) (-)

---

# PHASE 1 — Architecture Discovery

## Frontend Dependency Flow

```
Page (app/(portal)/*/page.tsx)
  ↓
Module Component (modules/*/components/*.tsx)
  ↓
Module Hook (modules/*/hooks/*.ts)
  ↓
Module Port Interface (modules/*/ports/I*Repository.ts)
  ↓
Module Adapter (modules/*/adapters/*HttpAdapter.ts) ← Zod parsing boundary
  ↓
Module API (modules/*/api/index.ts)
  ↓
Core API Client (core/api/client.ts) ← Axios + refresh interceptor
  ↓
Next.js Proxy (next.config.ts) → /api/* → Backend
```

**Store Layer (Side-channel):**
```
Module Store ← Zustand ← Filter state (search, page, sort)
              ↑
Module Component reads store directly (skip hooks/ports/adapters)
```

**Key observation:** Dependency direction is **correct** — pages depend on modules, modules depend on core infrastructure. No circular dependencies.

## Backend Dependency Flow

```
Route (src/api/v1/routes/*.py)
  ↓
Service (src/services/*.py)
  ↓
BaseRepository / Direct SQLAlchemy queries
  ↓
Models (src/models/*.py)
  ↓
Database (core/database.py + asyncpg)
```

**Schema Layer (Validation Boundary):**
```
Route ← Pydantic Schema (src/schemas/*.py) — validates input/output
Service ← Optional Pydantic for internal DTOs
```

**Key observations:**
- `card_service.py` **violates** the dependency flow — opens its own `SessionLocal()` instead of using injected `db`
- `participation_per_sport_service.py` does **N+1 queries** inside `get()` and `list()` loading related entities individually
- `events_service.py` has a **duplicate method** (`remove_org_from_event_sport` defined twice at lines 194 and 197)
- `sports_service.py` has `add_sport_to_event` but this logic is duplicated in `events_service.py`
- No formal Repository pattern — services often mix raw SQLAlchemy with `BaseRepository`

---

# PHASE 2 — Security Audit

## Authentication

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| No account lockout/rate limiting on login | **HIGH** | `auth.py:20` | Login endpoint has no rate limiting. Brute force attack is trivial. No account lockout after N failures. |
| Access & refresh tokens share same signing key | **MEDIUM** | `security.py:46,53` | Both token types signed with `JWT_SECRET_KEY`. If key leaks, both token types are forgeable. Should use separate keys for access vs refresh. |
| No refresh token reuse detection | **HIGH** | `auth_service.py:146` | Token rotation deletes old record but does not detect OLD token reuse. If an attacker steals a refresh token, both the attacker and legitimate user can refresh until one uses it — but there's no family invalidation. |
| Access token not checked for revocation | **MEDIUM** | `deps.py:19` | `get_current_user` only decodes JWT and checks user exists. No check against a blocklist/revoked access tokens. Compromised access tokens remain valid until expiry (30min). |
| `/session/{user_id}` uses user-provided ID | **LOW** | `auth.py:102` | The session endpoint takes a `user_id` from the URL path rather than deriving it from the authenticated user. `get_current_user` dependency exists but is not leveraged for authorization on this route. |
| Logout doesn't require CSRF | **LOW** | `csrf.py:43` | Logout is CSRF-exempt. Although idempotent, an attacker could logout a victim via CSRF. |
| Weak bcrypt cost factor | **MEDIUM** | `security.py:11` | Uses default bcrypt rounds (12 in passlib 1.7.x). For a government system, consider cost factor 13-15. |
| SHA-256 truncation of passwords >72 bytes | **LOW** | `security.py:19-20` | Pre-truncation is a workaround for bcrypt's 72-byte limit, but if the SHA-256 output leaks, the original password beyond 72 bytes is still protected. Minimal risk. |

## Authorization

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| Missing org-scoped access control on dashboard | **MEDIUM** | `dashboard.py:23` | `get_dashboard` uses `get_effective_org_id` but `get_dashboard_events`, `get_dashboard_sports`, `get_dashboard_recent_enrollments` are always **global** — even org-scoped users see all events/sports/enrollments. Only stats and top_orgs are scoped. |
| Missing org-scoped access on events list | **LOW** | `events.py:56` | `list_events` has no auth at all, even for authenticated users. This is intentional for public access, but no distinction between public vs. internal event data. |
| IDOR check uses `get_owner_org_id` after the fact | **LOW** | `participant.py:239` | The GET/PATCH/DELETE participant endpoints check ownership by querying org_id after receiving the request. This is correct but adds an extra query. No race condition since it's within same transaction. |
| `require_staff` allows FEDERATION + ADMIN + SUPER_ADMIN | **INFO** | `deps.py:67` | FEDERATION role has same access as ADMIN for staff operations. This is by design but should be documented. |
| No row-level security on event association endpoints | **MEDIUM** | `events.py:306` | `add_org_to_event_sport` enforces org access via `enforce_org_access`, but there's no check if the org is already linked to the sport. Duplicate check only happens at DB unique constraint level. |

## Input Validation

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| `create_participant` accepts raw `dict` instead of Pydantic model | **MEDIUM** | `participant.py:41` | The endpoint accepts `payload: dict = Body(...)` and manually constructs `FullRegistrationRequest`. This bypasses FastAPI's automatic validation on the route handler level. |
| Registration schema `extra="ignore"` | **LOW** | `enroll.py:65` | Extra frontend fields are silently ignored. This is acceptable but should be `extra="forbid"` in production to detect API drift. |
| Document upload doesn't validate file types | **MEDIUM** | (inferred from schema URL fields) | `photoUrl`, `nationalityDocumentUrl` etc. are stored as URLs, likely uploaded via Cloudinary. No file type/size validation on the backend side. |
| No input sanitization against XSS | **MEDIUM** | All string fields | Names, addresses are stored and likely rendered in the frontend. No sanitization against stored XSS. |

## Web Security

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| No Content Security Policy header | **MEDIUM** | `main.py` | No CSP headers anywhere. This allows inline scripts and reduces defense-in-depth against XSS. |
| No Strict-Transport-Security | **MEDIUM** | `main.py` | No HSTS header. Users could be downgraded to HTTP in non-local environments. |
| No X-Content-Type-Options | **LOW** | `main.py` | MIME-sniffing not prevented. |
| CORS allows all headers/methods | **LOW** | `main.py:54-55` | `allow_methods=["*"]` and `allow_headers=["*"]` in production. Should be restricted to known headers and methods. |
| CORS credentials true with wildcard origins | **MEDIUM** | `main.py:52-55` | If `BACKEND_CORS_ORIGINS` is empty in production and origins list is empty, CORS middleware is not added at all — which is correct. But if set, credentials with specific origins works. |
| Login/refresh endpoints return tokens in response body | **LOW** | `auth_service.py:118` | Tokens are returned in JSON body AND set as HttpOnly cookies. The body is technically unnecessary since the frontend relies on cookies. |

## Sensitive Data

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| Logging middleware prints request paths | **LOW** | `loggine.py:17` | Emoji-based logging prints full request paths. If paths contain sensitive data (unlikely here but a pattern to be aware of). |
| PII access logging well-implemented | ✅ | `pii_access_log.py` | Audit log captures WHO accessed WHAT field WHEN, but never the value. Good. |
| Data minimization in participant list | ✅ | `participant_service.py:543` | `_format_list_row` omits phone, DOB, address, document URLs. Only detail endpoint returns full PII. Excellent. |

## OWASP Top 10 Mapping

| OWASP Category | Status | Key Issues |
|----------------|--------|------------|
| **A01: Broken Access Control** | ⚠️ MEDIUM | Dashboard leaks global events/sports to org users. No row-level security. |
| **A02: Cryptographic Failures** | ⚠️ MEDIUM | Same key for access/refresh tokens. Weak bcrypt cost. No access token revocation. |
| **A03: Injection** | ✅ LOW | SQLAlchemy parameterizes queries. No SQL injection vectors found. |
| **A04: Insecure Design** | ⚠️ MEDIUM | No rate limiting. No account lockout. Missing security headers. |
| **A05: Security Misconfiguration** | ⚠️ MEDIUM | CORS too permissive. No CSP/HSTS. Debug logging with emoji in production. |
| **A06: Vulnerable Components** | ⚠️ LOW | Bcrypt pinning at 4.0.1 (older). Dependencies should be audited. |
| **A07: Identification/Auth Failures** | ⚠️ HIGH | No rate limiting on login. No brute force protection. |
| **A08: Data Integrity Failures** | ✅ LOW | CSRF double-submit well implemented. Signed JWTs. |
| **A09: Security Logging/Monitoring** | ✅ MEDIUM | PII access logs are good. No centralized logging. Sentry configured. |
| **A10: SSRF** | ✅ LOW | No server-side request forgery vectors found. |

---

# PHASE 3 — Backend Performance Audit

## Database

| Issue | Impact | File | Detail |
|-------|--------|------|--------|
| N+1 queries in `ParticipationPerSportService.get()` | **HIGH** | `participation_per_sport.py:67-92` | For a single record: 1 query for item + 1 for org + 1 for seo + 1 for event = 4 queries. Should use JOIN. |
| N+1 queries in `ParticipationPerSportService.list()` | **CRITICAL** | `participation_per_sport.py:167-187` | Per item in the result set: 1 query for org + 1 for seo + 1 for event = 3N queries. With 100 items = 301 queries. |
| N+1 queries in `ExcelService.get_org_sport_participant_counts()` | **HIGH** | `excel_service.py:110-203` | Per sport: 1 query for athletes + 1 query for leaders = 2N queries + 1 for sports list. With 20 sports = 41 queries. |
| In-memory pagination for participant list | **HIGH** | `participant_service.py:147-164` | Fetches ALL athletes + ALL leaders matching filters, merges in Python, sorts, then paginates in memory. With 50K participants this kills performance. |
| No indexes on `enrollments.phonenumber` | **MEDIUM** | `enroll.py` | Search uses `ilike` on `phonenumber`, which requires full table scan without index. |
| No composite indexes on join columns | **MEDIUM** | Multiple models | `athlete_participation`, `leader_participation`, `sports_event_org` are filtered on `(events_id, sports_id, organization_id)` combinations but lack composite indexes. |
| `card_service.py` opens separate DB session | **MEDIUM** | `card_service.py:22` | Opens `SessionLocal()` directly instead of using the injected session. Bypasses connection pooling and transaction management. |
| Dashboard events/sports queries are always global | **MEDIUM** | `dashboard_service.py:55-66` | No pagination/filtering beyond limit 10. OK for small datasets, but will degrade. |
| Phase filtering loads all events in memory | **MEDIUM** | `events_service.py:45-56` | When phase_open_filters are used, ALL events are loaded from DB and filtered in Python. |

## API

| Issue | Impact | File | Detail |
|-------|--------|------|--------|
| No pagination metadata | **LOW** | Multiple routes | Count is returned but no total pages, has_next, or cursor. Frontend must compute these. |
| Dashboard returns 6 separate queries via `asyncio.gather` | **INFO** | `dashboard.py:36` | OK for now, but each query runs in parallel which keeps DB connections busy. Consider materialized view. |
| Excel endpoints may time out for large orgs | **MEDIUM** | `excel_service.py` | No streaming — loads all data into memory then returns as JSON. For orgs with 1000+ participants across 20+ sports, memory usage spikes. |

---

# PHASE 4 — Frontend Performance Audit

## Next.js / React

| Issue | Impact | File | Detail |
|-------|--------|------|--------|
| All portal pages are Client Components | **HIGH** | `app/(portal)/layout.tsx:1` | Portal layout is `"use client"`. Every page inside is a client component by inheritance. No server components possible. Loses RSC benefits. |
| Sidebar + TopBar render on every page | **MEDIUM** | `app/(portal)/layout.tsx` | Portal layout always renders Sidebar and TopBar, even on public-facing routes. Should be in layout group. |
| No dynamic imports for heavy components | **MEDIUM** | All pages | Components like `DataTable`, `Modal`, charts could be dynamically imported. None are. |
| No `React.memo` on large lists | **MEDIUM** | Various | Lists like `EventList`, `SportList`, `OrgList` don't use `React.memo` or virtualization. |

## React Query

| Issue | Impact | File | Detail |
|-------|--------|------|--------|
| Reference data has DUAL caching | **MEDIUM** | `core/api/referenceData.ts` | Reference data uses a custom in-memory cache (5 min TTL) AND React Query simultaneously. Two sources of truth. Wasteful. |
| Query keys not granular enough for invalidation | **MEDIUM** | `queryKeys.ts` | Keys like `['registrations']` and `['registrations', filter]` mean invalidating `['registrations']` wipes all registration queries. |
| Registrations and participations have `gcTime: undefined` | **LOW** | Registration hooks | PII data uses `staleTime: 0` (good) but `gcTime` defaults to 5 minutes — keeps PII in memory for 5 minutes after unmount. |
| No optimistic updates on mutations | **MEDIUM** | All hooks | Mutations invalidate and refetch rather than optimistically updating cache. Causes flickering. |

## Bundle / Network

| Issue | Impact | File | Detail |
|-------|--------|------|--------|
| Duplicate reference data fetchers | **MEDIUM** | Multiple modules | Events hooks in modules/bynumber, modules/survey, modules/events all fetch their own reference data. Network overhead. |
| No request deduplication | **MEDIUM** | `core/referenceData.ts` | Multiple components mounting at same time each trigger separate fetches despite the in-memory cache. |
| Axios interceptor refreshes via `axios.post` | **LOW** | `client.ts:43` | Refresh uses `axios.post` (new instance) instead of `apiClient.post`. Skips interceptors — intentional but could cause confusing behavior. |

---

# PHASE 5 — Architecture Maturity Review

## Architecture Type: **Hybrid — Clean/Hexagonal Frontend + Layered Backend**

**Frontend Score:** 8/10 for ports & adapters pattern
**Backend Score:** 6/10 for layered architecture with violations

## Layer Violations

| Violation | Severity | Location | Detail |
|-----------|----------|----------|--------|
| Card service opens own DB session | **HIGH** | `card_service.py:22` | `async with SessionLocal() as session:` — bypasses dependency injection and FastAPI's session lifecycle. Cannot be tested with mock sessions. |
| Duplicate method | **MEDIUM** | `events_service.py:194-198` | `remove_org_from_event_sport` defined twice. Second definition silently overrides first. |
| Duplicate business logic | **MEDIUM** | `sports_service.py:93-96` | `add_sport_to_event` duplicates logic in `events_service.py:92`. Two services both manage sport-event associations. |
| Route defines inline Pydantic models | **LOW** | `participant.py:275,307` | `ParticipantUpdateBody` and `ParticipantDeleteBody` are defined in the route file instead of `schemas/`. |
| No formal Use Case layer | **MEDIUM** | All services | Services directly expose CRUD operations. No `RegisterAthleteUseCase`, `SubmitParticipationUseCase`, etc. Business rules are embedded in service methods. |
| No dependency injection container | **LOW** | All services | Services are instantiated manually (`service = ParticipantService(db)`) in every route handler. |
| `athlete_service.py` is dead code | **LOW** | `athlete_service.py` | Mostly commented out. Suggests incomplete refactoring. |

## Missing Abstractions

- **No `IUnitOfWork` pattern** — transactions are managed ad-hoc with `flush()`/`commit()`/`rollback()` in each service
- **No `IClock` abstraction** — `datetime.now(timezone.utc)` and `date.today()` called directly everywhere, making time-dependent logic untestable
- **No `IQueryBus` / Specification pattern** — queries are built inline in services with raw SQLAlchemy
- **No formal Domain Events** — no event-driven communication between aggregates

---

# PHASE 6 — Roadmap

## 🔥 Quick Wins (1 day)

### 1. Fix N+1 in `ParticipationPerSportService.list()`
**Why:** Currently 3N queries. With 100 records → 301 DB round trips.
**Risk:** Low. Pure refactor.
**Complexity:** Low. Replace individual `db.get()` calls with JOIN queries.
**Expected Gain:** ~99% reduction in DB calls on this endpoint.
**Example:**
```python
query = (
    select(
        participation_per_sport,
        Organization.name_kh,
        Events.name_kh,
    )
    .outerjoin(Organization, participation_per_sport.org_id == Organization.id)
    .outerjoin(sports_event_org, participation_per_sport.sports_Events_id == sports_event_org.id)
    .outerjoin(Events, sports_event_org.events_id == Events.id)
)
```

### 2. Add rate limiting to login endpoint
**Why:** No brute force protection. Critical for a government system.
**Risk:** Low. Use `slowapi` or a simple in-memory counter.
**Complexity:** Low (add dependency + decorator).
**Expected Gain:** Prevents credential stuffing / brute force.
**Example:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
```

### 3. Fix duplicate method in `events_service.py`
**Why:** `remove_org_from_event_sport` is defined twice — the second definition at line 197 silently shadows the first.
**Risk:** None.
**Complexity:** Trivial (delete duplicate).
**Expected Gain:** Eliminates potential logic bug.

### 4. Add CSP and security headers
**Why:** No defense-in-depth against XSS.
**Risk:** Low (needs testing with inline styles).
**Complexity:** Low (add middleware).
**Expected Gain:** Mitigates XSS impact.
**Example:**
```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
```

## 📋 Short Term (1 week)

### 5. Implement refresh token reuse detection
**Why:** If a stolen refresh token is used by the attacker, the legitimate user's token family should be invalidated.
**Risk:** Medium. Changes auth flow.
**Complexity:** Medium. Track `jti` family and detect reuse.
**Expected Gain:** Stops refresh token theft in its tracks.
**Example:**
```python
# In auth_service.refresh_tokens():
if record.revoked:
    # Revoke ALL tokens for this user — token reuse detected
    await self.db.execute(
        update(RefreshToken).where(
            RefreshToken.user_id == user_id
        ).values(revoked=True)
    )
    raise HTTPException(status_code=401, detail="Session revoked — please log in again")
```

### 6. Add database indexes
**Why:** Missing indexes on frequently filtered columns cause full table scans.
**Risk:** Very low.
**Complexity:** Low.
**Expected Gain:** Dramatically improves search/filter performance.
**Indexes to add:**
```sql
CREATE INDEX idx_enrollments_phonenumber ON enrollments USING gin (phonenumber gin_trgm_ops);
CREATE INDEX idx_athlete_participation_org_event ON athlete_participation (organization_id, events_id);
CREATE INDEX idx_leader_participation_org_event ON leader_participation (organization_id, events_id);
CREATE INDEX idx_participation_per_sport_org ON participation_per_sport (org_id);
CREATE INDEX idx_enrollments_created_at ON enrollments (created_at DESC);
```

### 7. Fix card_service to use injected session
**Why:** Opens its own DB session, bypassing FastAPI DI and connection pooling.
**Risk:** Low.
**Complexity:** Low.
**Expected Gain:** Testability, transaction consistency, proper connection lifecycle.

### 8. Separate JWT signing keys
**Why:** Access and refresh tokens share `JWT_SECRET_KEY`.
**Risk:** Low.
**Complexity:** Low. Add `JWT_REFRESH_SECRET_KEY` to settings.
**Expected Gain:** Limits blast radius if one key is compromised.

## 🏗️ Medium Term (1 month)

### 9. Implement Alembic for schema migrations
**Why:** No migration tool exists. Schema changes are done ad-hoc via a maintenance endpoint (`/api/maintenance/sync-schema`). This is dangerous for production.
**Risk:** Medium. Requires migration audit.
**Complexity:** High. Must reverse-engineer current schema and create initial migration.
**Expected Gain:** Safe, tracked, reversible schema changes.

### 10. Fix in-memory pagination for participant list
**Why:** Fetches ALL matching records into memory, then paginates. Will crash with large datasets.
**Risk:** Medium. Changes query logic.
**Complexity:** High. Requires SQL-level pagination across two tables (athletes + leaders) using UNION or query design refactor.
**Expected Gain:** Stable performance at any scale.

### 11. Add Redis caching layer
**Why:** No caching on reference data, dashboard stats, or query results.
**Risk:** Low (additive).
**Complexity:** Medium. Add redis-py, create cache service.
**Expected Gain:** Dashboards load 10-50x faster. DB load reduced significantly.
**Caching targets:**
- Dashboard stats (5 min TTL)
- Reference data (events list, sports list, org list) — 10 min TTL
- Sport categories (5 min TTL)

### 12. Eliminate dual caching in frontend reference data
**Why:** `core/referenceData.ts` uses a custom in-memory cache AND React Query. Causes stale data and confusion.
**Risk:** Low.
**Complexity:** Medium. Remove custom cache, use React Query exclusively with `staleTime: 300000`.
**Expected Gain:** Single source of truth for server state.

## 🚀 Long Term (3 months)

### 13. Implement proper Use Case layer
**Why:** Services are CRUD-heavy with business rules embedded. No formal use cases means no single place to understand business operations.
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
      RegisterAthleteUseCase.py
      RegisterLeaderUseCase.py
      SearchParticipantsUseCase.py
```

### 14. Convert portal to use Server Components where possible
**Why:** All portal pages are Client Components, losing RSC benefits (smaller bundles, faster initial load).
**Risk:** Medium.
**Complexity:** High. Requires extracting interactive islands.
**Expected Gain:** 30-50% reduction in JS bundle size. Faster page loads.

### 15. Add comprehensive E2E test suite
**Why:** Only a few tests exist. Zero E2E tests for the auth flow, registration flow, or review workflow.
**Risk:** Low (additive).
**Complexity:** High.
**Expected Gain:** Confidence for refactoring. Regression prevention.

### 16. Implement structured logging with correlation IDs
**Why:** Currently uses `print()` with emoji. No structured fields, no searchability.
**Risk:** Low.
**Complexity:** Medium. Add structlog or python-json-logger.
**Expected Gain:** Log aggregation, debugging, audit trails.
