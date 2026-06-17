# Phase 3: Relationship Analysis

## Foreign Key Cross-Reference

- ✅ `User.organization_id` → `organizations.id` (SET NULL)
- ✅ `User.sport_id` → `sports.id` (SET NULL)
- ✅ `RefreshToken.user_id` → `users.id` (CASCADE)
- ✅ `PiiAccessLog.actor_user_id` → `users.id` (SET NULL) — confirmed in both migration `425f25068de6:99-101` and model `pii_access_log.py:21`
- ❌ `PiiAccessLog.target_enroll_id` → `enrollments.id` — **NO ForeignKey** at `pii_access_log.py:29`. Referential integrity is application-enforced only.
- ✅ `Enroll.user_id` → `users.id` (SET NULL)
- ✅ `athletes.enroll_id` → `enrollments.id` (CASCADE)
- ✅ `leader.enroll_id` → `enrollments.id` (CASCADE)
- ✅ `athlete_participation.athletes_id` → `athletes.id` (SET NULL)
- ✅ `athlete_participation.events_id` → `events.id` (SET NULL)
- ✅ `athlete_participation.sports_id` → `sports.id` (SET NULL)
- ✅ `athlete_participation.category_id` → `categories.id` (SET NULL)
- ✅ `athlete_participation.organization_id` → `organizations.id` (SET NULL)
- ✅ `athlete_participation.team_id` → `teams.id` (SET NULL)
- ✅ `leader_participation.leaders_id` → `leaders.id` (SET NULL)
- ✅ `leader_participation.events_id` → `events.id` (SET NULL)
- ✅ `leader_participation.sports_id` → `sports.id` (SET NULL)
- ✅ `leader_participation.organization_id` → `organizations.id` (SET NULL)
- ✅ `category.sports_id` → `sports.id` (SET NULL)
- ✅ `category.events_id` → `events.id` (SET NULL)
- ✅ `sports_event.events_id` → `events.id` (SET NULL)
- ✅ `sports_event.sports_id` → `sports.id` (SET NULL)
- ✅ `sports_event_org.events_id` → `events.id` (SET NULL)
- ✅ `sports_event_org.sports_id` → `sports.id` (SET NULL)
- ✅ `sports_event_org.organization_id` → `organizations.id` (SET NULL)
- ✅ `participation_per_sport.sports_Events_id` → `sports_event_org.id` (SET NULL)
- ✅ `participation_per_sport.org_id` → `organizations.id` (SET NULL)
- ✅ `team.event_id` → `events.id` (CASCADE)
- ✅ `team.sport_id` → `sports.id` (CASCADE)
- ✅ `team.org_id` → `organizations.id` (CASCADE)
- ✅ `team.category_id` → `categories.id` (SET NULL)
- ✅ `Medal.athlete_participation_id` → `athlete_participation.id` (SET NULL)
- ✅ `OrganizerParticipation.enroll_id` → `enrollments.id` (CASCADE)
- ✅ `OrganizerParticipation.event_id` → `events.id` (CASCADE)
- ✅ `OrganizerParticipation.organization_id` → `organizations.id` (SET NULL)
- ✅ `OrganizerParticipation.organizer_role_id` → `organizer_roles.id` (RESTRICT)
- ✅ `OpenSurveyField.event_id` → `events.id` (CASCADE)
- ✅ `OpenSurveyResponse.field_id` → `open_survey_fields.id` (CASCADE)
- ✅ `OpenSurveyResponse.organization_id` → `organizations.id` (CASCADE)

## Unique Constraints Verified
- ✅ `users.email` (unique)
- ✅ `users.username` (unique)
- ✅ `organization.code` (unique)
- ✅ `categories`: `uix_event_sport_category` on `(events_id, sports_id, category)`
- ✅ `sports_event`: `uix_event_sport` on `(events_id, sports_id)`
- ✅ `sports_event_org`: `uix_event_sport_org` on `(events_id, sports_id, organization_id)`
- ✅ `teams.name` alone (not unique — no UniqueConstraint in `team.py:7`)

## Cascade Behavior Summary
| Model | FK | On Delete |
|---|---|---|
| RefreshToken | user_id | CASCADE |
| athletes | enroll_id | CASCADE |
| leader | enroll_id | CASCADE |
| athlete_participation | athletes_id | SET NULL |
| leader_participation | leaders_id | SET NULL |
| team | event_id, sport_id, org_id | CASCADE |
| OrganizerParticipation | enroll_id, event_id | CASCADE |
| OrganizerParticipation | organizer_role_id | RESTRICT |
| OpenSurveyField | event_id | CASCADE |
| OpenSurveyResponse | field_id, organization_id | CASCADE |
| All others | various | SET NULL |

## Noteworthy Findings

### R1 — Missing FK constraint on `PiiAccessLog.target_enroll_id`
**Severity: LOW**

The `target_enroll_id` column in `pii_access_logs` (at `pii_access_log.py:29`) references `enrollments.id` semantically but lacks a database-level ForeignKey constraint. If an enrollment is deleted, PII audit log entries will become orphaned with no way to detect the broken reference at the DB level. This is a minor referential integrity gap.

### R2 — Maintenance sync-schema uses raw SQL via `text()`
**Severity: LOW**

The `sync-schema` endpoint at `maintenance.py:30-66` uses raw SQL strings via SQLAlchemy `text()` with `ADD COLUMN IF NOT EXISTS` instead of Alembic migrations. This is a code smell — schema changes should be handled through the migration system for consistency and auditability.
