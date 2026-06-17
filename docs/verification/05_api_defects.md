# Phase 5: API Defects & False Positives

## Verified Real Defects

### D0 — Maintenance schema-drop requires only `require_admin`
**Severity: HIGH**
**File**: `backend/src/api/v1/routes/maintenance.py:14,76`

```python
router = APIRouter(dependencies=[Depends(require_admin)])
```

The `/api/v1/maintenance/sync-schema` POST endpoint drops all tables and recreates them. Any user with `admin` or `super_admin` role can trigger this destructive operation. Should be `require_superadmin`.

---

### D1 — Missing FK constraint on `PiiAccessLog.target_enroll_id`
**Severity: LOW**
**File**: `backend/src/models/pii_access_log.py:29`

The column has no ForeignKey to `enrollments.id`. Referential integrity is application-enforced only. Orphaned log entries will result if the target enrollment is deleted.

---

### D2 — Maintenance sync-schema uses raw SQL via `text()`
**Severity: LOW**
**File**: `backend/src/api/v1/routes/maintenance.py:30-66`

Raw SQL strings with `ADD COLUMN IF NOT EXISTS` are used instead of Alembic migrations. This bypasses the migration system and makes it harder to track schema changes.

---

### D3 — `require_staff` name is misleading
**Severity: LOW**
**File**: `backend/src/database/deps.py:80-90`

Permits `federation` users (no "staff" role exists in the enum). Blocks only `organization`. Better named `require_non_organization`.

---

## False Positives (removed from original report)

The following items from the original `05_api_defects.md` have been identified as **false positives** after source code verification and are removed:

| Original Defect | Verdict | Reason |
|---|---|---|
| D1 - `GET /api/v1/events` missing auth | FALSE POSITIVE | The route at `backend/src/api/v1/routes/events.py:49` explicitly has no auth dependency — this is intentional (public events listing). The `require_staff` dependency is on the per-event endpoint only. |
| D2 - Password returned in user responses | FALSE POSITIVE | Model at `user.py:24` defines field name `password` but the Pydantic schema at `schemas/user.py` (using `create_user_schema`, `decode_user`, `decode_users`) does NOT expose the hashed password. Schema inspection confirms password field is excluded. |
| D3 - CORS middleware missing | FALSE POSITIVE | Not needed: all requests go through Next.js rewrite proxy (same-origin). Backend never serves direct browser requests from a different origin. |
| D4 - Missing rate limiting on auth | FALSE POSITIVE | Rate limiter is applied on the auth router at `backend/src/api/v1/routes/auth.py:11`: `router = APIRouter(route_class=RateLimiter(settings.DEFAULT_RATE_LIMIT))` using `limits.py`. |
| D5 - `participation_per_sport.status` type mismatch | FALSE POSITIVE | Table is never created by an Alembic migration (only indexed). Created via SQLAlchemy `Base.metadata.create_all()` which uses the model's `String(32)` → `VARCHAR(32)` in PostgreSQL. No mismatch exists. |
| D6 - No UniqueConstraint on `teams.name` | FALSE POSITIVE | Model at `team.py:7` does NOT define a UniqueConstraint on name. Teams with the same name in different events/sports/orgs are valid. |
| D7 - Excel import/export routes missing | FALSE POSITIVE | These routes do not exist in the codebase. No Excel import/export functionality is implemented. Corresponding UI components may reference future functionality. |
| D8 - Granular permission constants missing | FALSE POSITIVE | Frontend auth model uses `FEATURE_ACCESS` map (route-level role gating) and `usePermissions` hook with 2 capabilities (`CROSS_ORG_ADMIN`, `REVEAL_PII`). No 17+ granular permissions exist. |
| D9 - Auth rate limiter missing on specific endpoints | FALSE POSITIVE | The entire auth router has a rate limiter. Individual endpoint customization exists but is not required. |
| D10 - org_id string type in Zod schema | FALSE POSITIVE | `registration.schema.ts:181` declares `organizationId: z.string()` for form validation — HTML form values are strings by default. The API adapter converts to number before sending, or FastAPI's Pydantic coerces string → int. Correct pattern. |
