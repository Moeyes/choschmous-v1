# Phase 4: Permission Analysis

## Backend Authorization Model

### Dependency Functions (`backend/src/database/deps.py`)

There are 4 auth dependency functions:

| Function | Lines | Effect |
|---|---|---|
| `get_current_user` | 34-50 | Extracts user from JWT (access token in Authorization header or cookie). Returns `User` or raises 401. |
| `require_superadmin` | 61-69 | Requires `UserRole.super_admin`. Raises 403 if not. |
| `require_admin` | 71-79 | Requires `UserRole.super_admin` or `UserRole.admin`. Raises 403 if not. |
| `require_staff` | 80-90 | Blocks only `UserRole.organization`. Allows `super_admin`, `admin`, and `federation`. Raises 403 with detail "Requires staff privileges". |

Additionally:

| Function | Lines | Effect |
|---|---|---|
| `get_effective_org_id` | 97-111 | For org users, returns their org_id from the JWT claim. For staff/admin/superadmin, checks query param `org_id` and enforces that they can access it. |
| `enforce_org_access` | 117-131 | Verifies that a user has access to a given org. Rejects with 403 if unauthorized. |

### `UserRole` Enum (`backend/src/models/enum/user.py:5-8`)
```python
class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    organization = "organization"
    federation = "federation"
```

### Auth Dependency Usage by Route
- **No auth**: `GET /api/v1/events`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
- `get_current_user`: Auth `/me`, Cloudinary, Upload
- `get_effective_org_id`: All org-write endpoints (enrollments, teams, participations, survey responses, org-level sport config)
- `require_staff`: Read/query endpoints (events/{id}, sports, organizations, categories, teams/{id}, enrollments, dashboard, reports, organizers, survey fields/responses)
- `require_admin`: Create/update/delete except super_admin-gated resources (users CRUD, events CRUD, sports CRUD, organizations, sport config, categories, organizer roles, survey fields, PII logs)
- `require_superadmin`: `DELETE users/{id}`, `DELETE sports/{id}`, `DELETE organizations/{id}`

## Frontend Authorization Model

### `UserRole` Enum (`frontend/src/core/auth/types/index.ts:5-9`)
```typescript
export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  ORGANIZATION = "organization",
  FEDERATION = "federation",
}
```

### `FEATURE_ACCESS` Map (`frontend/src/core/auth/types/index.ts:93-121`)
This is the real frontend authorization mechanism: a map of feature route segments to permitted roles.

```typescript
export const FEATURE_ACCESS: Record<string, UserRole[]> = {
  users: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  events: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
  sports: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  organizations: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORGANIZATION, UserRole.FEDERATION],
  categories: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  participants: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
  teams: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
  dashboard: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
  reports: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION],
  survey: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
  organizers: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FEDERATION, UserRole.ORGANIZATION],
};
```

### `usePermissions` Hook (`frontend/src/core/auth/usePermissions.ts`)
Only **2 capabilities**, not the 17+ granular permissions implied in the original file:

```typescript
export type Permission = 'CROSS_ORG_ADMIN' | 'REVEAL_PII';
```

- `CROSS_ORG_ADMIN`: User role is `super_admin` or `admin` and user has an `org_id` claim in their JWT.
- `REVEAL_PII`: User role is `super_admin`, `admin`, or `federation`.

### CSRF / API Client Security (`frontend/src/core/api/`)
- **`baseURL: '/'`** with `withCredentials: true` — all requests go to the same origin; Next.js rewrites proxy `/api/*` to the backend (`client.ts:12-26`).
- **CSRF tokens**: Sent on all mutation methods (`POST`, `PUT`, `DELETE`, `PATCH`) via the `X-CSRF-Token` header, read from the `csrf-token` cookie (`headers.ts:44-46`). Read operations (`GET`) skip the CSRF header.
- **Proactive refresh**: If a 401 response is received, the interceptor attempts to refresh the access token before retrying (`client.ts`).

## Findings

### P1 — `require_staff` name is misleading
**Severity: LOW** — see `deps.py:80-90`

The function permits `federation` users despite its name. There is no "staff" role in `UserRole`. This causes confusion about what the function actually gates.

### P2 — No frontend role-based component rendering at the component level
**Severity: INFO**

The FEATURE_ACCESS map is used for route-level gating only. Individual components do not check `can()` or any equivalent function. If a route is accessible to multiple roles, all child components are visible to all of those roles. Currently this is acceptable since components do not expose sensitive functionality beyond what routes already gate.

### P3 — Maintenance drop-schema uses `require_admin` not `require_superadmin`
**Severity: HIGH** — see `maintenance.py:14`

Already documented in X.1, reiterated here because it is a permission escalation vulnerability. Any `admin` (not just `super_admin`) can trigger a full schema drop and recreate.
