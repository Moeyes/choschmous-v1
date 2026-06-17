# Phase 2: CRUD Matrix

## Conventions
- All routes are under `/api/v1/`
- Auth header: `Authorization: Bearer <JWT>` (not required for public routes)
- Request body format: JSON unless noted
- Responses: JSON

## Flagged Issues
### X.1 — Maintenance endpoints use `require_admin` instead of `require_superadmin`
**Severity: HIGH** — `maintenance.py:14,76`

The maintenance route at `backend/src/api/v1/routes/maintenance.py` uses:
```python
router = APIRouter(dependencies=[Depends(require_admin)])
```

This means any user with role `admin` or `super_admin` can:
- Sync the database schema (drop and recreate all tables: `POST /api/v1/maintenance/sync-schema` at line 76)
- This is a destructive operation that should be restricted to `super_admin` only.

The `require_admin` dependency (at `backend/src/database/deps.py:71-79`) allows both `super_admin` and `admin`:

```python
def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.super_admin, UserRole.admin):
        raise AuthException(status_code=403, detail="Requires admin privileges")
    return current_user
```

Compare with `require_superadmin` (deps.py:61-69):
```python
def require_superadmin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.super_admin:
        raise AuthException(status_code=403, detail="Requires super admin")
    return current_user
```

**Resolution:** Change line 14 to use `require_superadmin`.

### X.2 — `require_staff` name is misleading
**Severity: LOW** — `deps.py:80-90`

The function `require_staff` blocks only `organization` role:
```python
def require_staff(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.organization:
        raise AuthException(status_code=403, detail="Requires staff privileges")
    return current_user
```

Despite the name "staff", it allows `federation` users. There is no "staff" role in the `UserRole` enum. The function would be better named `require_non_organization` or `require_staff_or_admin`.

---

## Route Inventory

### Auth
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/auth/login` | None | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | None | Refresh access token via refresh token cookie |
| POST | `/api/v1/auth/logout` | `get_current_user` (optional) | Revoke refresh token |
| GET | `/api/v1/auth/me` | `get_current_user` | Get current user profile |
| PUT | `/api/v1/auth/me` | `get_current_user` | Update current user profile |

### Users
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/users/` | `require_admin` | List users (paginated) |
| POST | `/api/v1/users/` | `require_admin` | Create user |
| GET | `/api/v1/users/{user_id}` | `require_admin` | Get user by ID |
| PUT | `/api/v1/users/{user_id}` | `require_admin` | Update user |
| DELETE | `/api/v1/users/{user_id}` | `require_superadmin` | Delete user |
| PUT | `/api/v1/users/{user_id}/deactivate` | `require_admin` | Deactivate user |
| PUT | `/api/v1/users/{user_id}/activate` | `require_admin` | Activate user |
| PUT | `/api/v1/users/{user_id}/reset-password` | `require_admin` | Admin-initiated password reset |

### Events
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/events` | **None** (public) | List events |
| POST | `/api/v1/events` | `require_admin` | Create event |
| GET | `/api/v1/events/{event_id}` | `require_staff` | Get event by ID |
| PUT | `/api/v1/events/{event_id}` | `require_admin` | Update event |
| DELETE | `/api/v1/events/{event_id}` | `require_admin` | Delete event |
| PUT | `/api/v1/events/{event_id}/close-registration` | `require_admin` | Close registration phase |
| PUT | `/api/v1/events/{event_id}/open-registration` | `require_admin` | Open registration phase |

### Sports
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/sports/` | `require_staff` | List sports |
| POST | `/api/v1/sports/` | `require_admin` | Create sport |
| GET | `/api/v1/sports/{sport_id}` | `require_staff` | Get sport by ID |
| PUT | `/api/v1/sports/{sport_id}` | `require_admin` | Update sport |
| DELETE | `/api/v1/sports/{sport_id}` | `require_superadmin` | Delete sport |

### Organizations
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/organizations/` | `require_staff` | List organizations |
| POST | `/api/v1/organizations/` | `require_admin` | Create organization |
| GET | `/api/v1/organizations/{org_id}` | `require_staff` | Get organization by ID |
| PUT | `/api/v1/organizations/{org_id}` | `require_admin` | Update organization |
| DELETE | `/api/v1/organizations/{org_id}` | `require_superadmin` | Delete organization |

### Sports Event Config
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/events/{event_id}/sports` | `require_staff` | List sports configured for an event |
| POST | `/api/v1/events/{event_id}/sports` | `require_admin` | Add sport to event config |
| PUT | `/api/v1/events/{event_id}/sports/{sport_id}` | `require_admin` | Update sport config in event |
| DELETE | `/api/v1/events/{event_id}/sports/{sport_id}` | `require_admin` | Remove sport from event config |

### Sports Event Org (org-level sport participation status)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/events/{event_id}/sports/{sport_id}/orgs` | `require_staff` | List org participation for a sport in event |
| PUT | `/api/v1/events/{event_id}/sports/{sport_id}/orgs` | `get_effective_org_id` | Submit/update org-level sport participation |
| PUT | `/api/v1/events/{event_id}/sports/{sport_id}/orgs/{org_id}/review` | `require_staff` | Review org participation |

### Participation Per Sport (org-level athlete/leader counts)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/sports_events/{se_id}/participation` | `require_staff` | Get participation counts |
| PUT | `/api/v1/sports_events/{se_id}/participation` | `get_effective_org_id` | Update participation counts (org submits) |
| PUT | `/api/v1/sports_events/{se_id}/participation/review` | `require_staff` | Review participation counts |

### Categories
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/events/{event_id}/sports/{sport_id}/categories` | `require_staff` | List categories for sport in event |
| POST | `/api/v1/events/{event_id}/sports/{sport_id}/categories` | `require_admin` | Create category |
| DELETE | `/api/v1/events/{event_id}/sports/{sport_id}/categories/{category_id}` | `require_admin` | Delete category |

### Teams
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/teams/` | `require_staff` | List teams |
| POST | `/api/v1/teams/` | `get_effective_org_id` | Create team |
| GET | `/api/v1/teams/{team_id}` | `require_staff` | Get team by ID |
| PUT | `/api/v1/teams/{team_id}` | `get_effective_org_id` | Update team (org submits) |
| DELETE | `/api/v1/teams/{team_id}` | `require_staff` | Delete team |
| PUT | `/api/v1/teams/{team_id}/lock` | `require_staff` | Lock team |
| PUT | `/api/v1/teams/{team_id}/unlock` | `require_staff` | Unlock team |

### Enrollments (participants)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/enrollments/` | `get_effective_org_id` | Create enrollment (participant) |
| GET | `/api/v1/enrollments/{enroll_id}` | `require_staff` | Get enrollment by ID |
| PUT | `/api/v1/enrollments/{enroll_id}` | `get_effective_org_id` | Update enrollment |
| DELETE | `/api/v1/enrollments/{enroll_id}` | `require_staff` | Delete enrollment |
| GET | `/api/v1/enrollments/{enroll_id}/search` | `require_staff` | Search enrollments |

### Athlete Participations (enrolling athletes in sports)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/enrollments/{enroll_id}/athlete` | `get_effective_org_id` | Convert enrollment to athlete |
| DELETE | `/api/v1/enrollments/{enroll_id}/athlete` | `require_staff` | Remove athlete status |
| POST | `/api/v1/athletes/{athlete_id}/participations` | `get_effective_org_id` | Add sport participation for athlete |
| DELETE | `/api/v1/athletes/{athlete_id}/participations/{participation_id}` | `require_staff` | Remove athlete participation |
| PUT | `/api/v1/athletes/{athlete_id}/participations/{participation_id}/lock` | `require_staff` | Lock athlete participation |
| PUT | `/api/v1/athletes/{athlete_id}/participations/{participation_id}/unlock` | `require_staff` | Unlock athlete participation |

### Leader Participations (enrolling leaders in sports)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/enrollments/{enroll_id}/leader` | `get_effective_org_id` | Convert enrollment to leader |
| DELETE | `/api/v1/enrollments/{enroll_id}/leader` | `require_staff` | Remove leader status |
| POST | `/api/v1/leaders/{leader_id}/participations` | `get_effective_org_id` | Add sport participation for leader |
| DELETE | `/api/v1/leaders/{leader_id}/participations/{participation_id}` | `require_staff` | Remove leader participation |

### PII Access Log
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/pii-logs/` | `require_admin` | List PII access logs |
| GET | `/api/v1/pii-logs/{log_id}` | `require_admin` | Get PII access log by ID |
| POST | `/api/v1/pii-logs/` | `require_staff` | Log PII access |

### Dashboard
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/dashboard/` | `require_staff` | Dashboard statistics |

### Reports
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/reports/` | `require_staff` | Reports |
| GET | `/api/v1/reports/medals` | `require_staff` | Medal reports |

### Maintenance
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/maintenance/sync-schema` | `require_admin` | **HIGH**: Drop and recreate tables |

### Cloudinary Upload
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/cloudinary/sign` | `get_current_user` | Get presigned upload signature |
| POST | `/api/v1/cloudinary/confirm` | `get_current_user` | Confirm upload (record in uploaded_files) |

### File Upload (direct to DB)
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| POST | `/api/v1/upload/` | `get_current_user` | Upload file to DB (`uploaded_files`) |
| GET | `/api/v1/upload/{file_id}` | `get_current_user` | Download file from DB |

### Organizers
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/organizers/roles` | `require_staff` | List organizer roles |
| POST | `/api/v1/organizers/roles` | `require_admin` | Create organizer role |
| PUT | `/api/v1/organizers/roles/{role_id}` | `require_admin` | Update organizer role |
| DELETE | `/api/v1/organizers/roles/{role_id}` | `require_admin` | Delete organizer role |
| GET | `/api/v1/organizers/` | `require_staff` | List organizer participations |
| POST | `/api/v1/organizers/` | `get_effective_org_id` | Register organizer |
| DELETE | `/api/v1/organizers/{org_part_id}` | `require_staff` | Remove organizer |

### Open Survey
| Method | Path | Auth Dependency | Description |
|---|---|---|---|
| GET | `/api/v1/events/{event_id}/survey/fields` | `require_staff` | List survey fields for event |
| POST | `/api/v1/events/{event_id}/survey/fields` | `require_admin` | Create survey field |
| PUT | `/api/v1/events/{event_id}/survey/fields/{field_id}` | `require_admin` | Update survey field |
| DELETE | `/api/v1/events/{event_id}/survey/fields/{field_id}` | `require_admin` | Delete survey field |
| GET | `/api/v1/events/{event_id}/survey/responses` | `require_staff` | List survey responses |
| POST | `/api/v1/events/{event_id}/survey/responses` | `get_effective_org_id` | Submit survey response |
| PUT | `/api/v1/events/{event_id}/survey/responses` | `get_effective_org_id` | Update survey response |
