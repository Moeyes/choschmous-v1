# Phase 1: Entity & Schema Extraction

## 1.1 SQLAlchemy Models — Complete Inventory

### Enum Types (shared across models)
Defined in `backend/src/models/enum/user.py` and `backend/src/models/enum/event.py`:

| Enum | Values | Used By |
|---|---|---|
| `UserRole` | `super_admin`, `admin`, `organization`, `federation` | `User.role` |
| `eventType` | `NATIONAL`, `UNIVERSITY`, `HIGH_SCHOOL`, `PRIMARY_SCHOOL` (Khmer strings) | `Events.type` |
| `AgeMode` | `BIRTH_YEAR`, `EXACT_AGE` | `Events.age_mode` |
| `PhaseStatus` | `AUTO`, `OPEN`, `CLOSED` | `Events` phase columns (×5) |
| `SportMode` | `individual`, `team`, `both` | `sports_event.mode` |
| `genderEnum` | `MALE`, `FEMALE`, `MIXED` | `Enroll.gender`, `category.gender` |
| `medal_typeEnum` | `GOLD`, `SILVER`, `BRONZE`, `none` | `Medal.medal_type` |
| `IdDocumentType` | `CAM_NID`, `CAM_PASSPORT`, `CAM_BIRTH_CERT`, `CAM_FAMILY_BOOK`, `OTHER` | `Enroll.id_document_type` |
| `LeaderRole` | `COACH`, `MANAGER`, `DELEGATE`, `TEAM_LEAD`, `COACH_TRAINER`, `TEACHER_ASSISTANT` | `leader.LeaderRole` |
| `instituteType` | (defined in Organization model) | `Organization.type` |

### Model: `User`
- **File**: `backend/src/models/user.py:11`
- **Table**: `users`
- **Imports**: `from src.models.enum.user import UserRole`
- **Primary Key**: `id` (UUID, server_default=gen_random_uuid)

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | |
| kh_family_name | String(100) | NO | | |
| kh_given_name | String(100) | NO | | |
| en_family_name | String(100) | NO | | |
| en_given_name | String(100) | NO | | |
| email | String(120) | NO (unique) | | |
| username | String(50) | NO (unique) | | |
| full_name | String(255) | YES | | |
| hashed_password | String(255) ("password") | NO | | |
| is_active | Boolean | NO | true | |
| is_superuser | Boolean | NO | false | |
| failed_attempts | Integer | NO | 0 | |
| locked_until | DateTime(tz) | YES | | |
| role | UserRole (enum) | NO | 'organization' | Enum: user_role |
| photo_path | String(255) | YES | | |
| organization_id | Integer | YES | | FK -> organizations.id (SET NULL) |
| sport_id | Integer | YES | | FK -> sports.id (SET NULL) |
| created_at | DateTime | NO | now() | |
| token_valid_from | DateTime(tz) | YES | | |

**Relationships**: `refresh_tokens` (one-to-many, cascade="all, delete-orphan"), `organization` (many-to-one), `sport` (many-to-one)

### Model: `RefreshToken`
- **File**: `backend/src/models/refresh_token.py:10`
- **Table**: `refresh_tokens`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement | |
| jti | String(64) | NO (unique, indexed) | | |
| token_hash | String(128) | NO | | |
| user_id | UUID | NO (indexed) | | FK -> users.id (CASCADE) |
| expires_at | DateTime(tz) | NO | | |
| revoked | Boolean | NO | false | |
| created_at | DateTime | NO | now() | |

**Relationships**: `user` (many-to-one, back_populates="refresh_tokens")

### Model: `PiiAccessLog`
- **File**: `backend/src/models/pii_access_log.py:10`
- **Table**: `pii_access_logs`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement | |
| actor_user_id | UUID | YES (indexed) | | FK -> users.id (SET NULL) |
| actor_role | String(32) | NO | | |
| target_enroll_id | Integer | NO (indexed) | | **NO FK** — plain column only |
| fields | String(255) | NO | | |
| created_at | DateTime(tz) | NO | now() | |

**Note**: `target_enroll_id` references `enrollments.id` conceptually but has **no ForeignKey constraint**. Referential integrity is enforced at the application layer only.

### Model: `Events`
- **File**: `backend/src/models/events.py:54`
- **Table**: `events`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | | |
| name_kh | String(100) | NO | | |
| type | eventType (enum) | NO | | |
| start_date | Date | YES | | |
| end_date | Date | YES | | |
| description | String(1000) | YES | | |
| location | String(255) | YES | | |
| age_mode | AgeMode (enum) | YES | | |
| age_min | Integer | YES | | |
| age_max | Integer | YES | | |
| participant_cap | Integer | YES | | |
| survey_category_status | PhaseStatus | NO | 'AUTO' | |
| survey_category_open_date | Date | YES | | |
| survey_category_close_date | Date | YES | | |
| survey_sport_status | PhaseStatus | NO | 'AUTO' | |
| survey_sport_open_date | Date | YES | | |
| survey_sport_close_date | Date | YES | | |
| survey_number_status | PhaseStatus | NO | 'AUTO' | |
| survey_number_open_date | Date | YES | | |
| survey_number_close_date | Date | YES | | |
| survey_open_status | PhaseStatus | NO | 'AUTO' | |
| survey_open_open_date | Date | YES | | |
| survey_open_close_date | Date | YES | | |
| registration_status | PhaseStatus | NO | 'AUTO' | |
| registration_open_date | Date | YES | | |
| registration_close_date | Date | YES | | |
| created_at | DateTime | NO | now() | |

**Properties**: `survey_category_is_open`, `survey_sport_is_open`, `survey_number_is_open`, `survey_open_is_open`, `registration_is_open` — all use `phase_is_open()` helper (`events.py:31-51`), which safely handles None dates (returns False).

### Model: `Enroll`
- **File**: `backend/src/models/enroll.py:13`
- **Table**: `enrollments`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement | |
| kh_family_name | String(100) | NO | | |
| kh_given_name | String(100) | NO | | |
| en_family_name | String(100) | NO | | |
| en_given_name | String(100) | NO | | |
| phonenumber | String(100) | NO | | |
| search_text | String(605) | YES | Computed | |
| gender | genderEnum | NO | | |
| nationality | String(100) | NO | 'Cambodian' | |
| date_of_birth | Date | NO | | |
| id_document_type | IdDocumentType (enum) | NO | | |
| address | String(500) | YES | | |
| photo_path | String(255) | YES | | |
| documents_path | String(255) | YES | | |
| nationality_document_path | String(255) | YES | | |
| birth_certificate_path | String(255) | YES | | |
| national_id_path | String(255) | YES | | |
| passport_path | String(255) | YES | | |
| created_at | DateTime | NO | now() | |
| user_id | UUID | YES (indexed) | | FK -> users.id (SET NULL) |

**Relationships**: `athlete` (one-to-one), `leader` (one-to-one)

### Model: `athletes`
- **File**: `backend/src/models/athletes.py:9`
- **Table**: `athletes`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | | |
| created_at | DateTime | NO | now() | |
| enroll_id | Integer | NO (indexed) | | FK -> enrollments.id (CASCADE) |

**Relationships**: `enroll` (many-to-one), `participations` (one-to-many -> athlete_participation, cascade=all,delete-orphan)

### Model: `leader`
- **File**: `backend/src/models/leader.py:9`
- **Table**: `leaders`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | | |
| LeaderRole | LeaderRole (enum) | NO | | |
| created_at | DateTime | NO | now() | |
| enroll_id | Integer | NO (indexed) | | FK -> enrollments.id (CASCADE) |

**Relationships**: `enroll` (many-to-one), `participations` (one-to-many -> leader_participation)

### Model: `athlete_participation`
- **File**: `backend/src/models/athlete_participation.py:16`
- **Table**: `athlete_participation`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement | |
| athletes_id | Integer | YES (indexed) | | FK -> athletes.id (SET NULL) |
| events_id | Integer | YES | | FK -> events.id (SET NULL) |
| sports_id | Integer | YES | | FK -> sports.id (SET NULL) |
| category_id | Integer | YES | | FK -> categories.id (SET NULL) |
| organization_id | Integer | YES | | FK -> organizations.id (SET NULL) |
| team_id | Integer | YES (indexed) | | FK -> teams.id (SET NULL) |
| created_at | DateTime | NO | now() | |

**Relationships**: `athlete` (many-to-one), `sport` (many-to-one), `category` (many-to-one), `organization` (many-to-one), `team` (many-to-one)

### Model: `leader_participation`
- **File**: `backend/src/models/leader_participation.py:14`
- **Table**: `leader_participation`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| leaders_id | Integer | YES (indexed) | | FK -> leaders.id (SET NULL) |
| events_id | Integer | YES (indexed) | | FK -> events.id (SET NULL) |
| sports_id | Integer | YES (indexed) | | FK -> sports.id (SET NULL) |
| organization_id | Integer | YES (indexed) | | FK -> organizations.id (SET NULL) |
| created_at | DateTime | NO | now() | |

**Relationships**: `leader_obj` (many-to-one), `sport` (many-to-one), `organization` (many-to-one)

### Model: `Sport`
- **File**: `backend/src/models/sport.py:8`
- **Table**: `sports`

| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Integer | NO | |
| name_kh | String(100) | NO | |
| sport_type | String(100) | YES | |
| created_at | DateTime | NO | now() |

### Model: `category`
- **File**: `backend/src/models/category.py:8`
- **Table**: `categories`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| sports_id | Integer | YES (indexed) | | FK -> sports.id (SET NULL) |
| category | String(100) | NO | | |
| gender | genderEnum | YES | | |
| events_id | Integer | YES (indexed) | | FK -> events.id (SET NULL) |
| created_at | DateTime | NO | now() | |

**UniqueConstraint**: `(events_id, sports_id, category)` — `uix_event_sport_category`

### Model: `Organization`
- **File**: `backend/src/models/organization.py:10`
- **Table**: `organizations`

| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) |
| name_kh | String(100) | NO | |
| name_en | String(100) | YES | |
| type | instituteType (enum) | NO | |
| code | String(36) | NO (unique) | uuid4() |
| created_at | DateTime | NO | now() |

### Model: `sports_event`
- **File**: `backend/src/models/sports_event.py:15`
- **Table**: `sports_event`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| events_id | Integer | YES (indexed) | | FK -> events.id (SET NULL) |
| sports_id | Integer | YES (indexed) | | FK -> sports.id (SET NULL) |
| mode | SportMode (enum) | NO | 'individual' | |
| team_size_min | Integer | YES | | |
| team_size_max | Integer | YES | | |
| quota_athletes_per_org | Integer | YES | | |
| quota_teams_per_org | Integer | YES | | |
| created_at | DateTime | NO | now() | |

**UniqueConstraint**: `(events_id, sports_id)` — `uix_event_sport`

### Model: `sports_event_org`
- **File**: `backend/src/models/sports_event_org.py:8`
- **Table**: `sports_event_org`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| events_id | Integer | YES (indexed) | | FK -> events.id (SET NULL) |
| sports_id | Integer | YES (indexed) | | FK -> sports.id (SET NULL) |
| organization_id | Integer | YES (indexed) | | FK -> organizations.id (SET NULL) |
| status | String(20) | NO | 'SUBMITTED' | |
| review_note | String (unbounded) | YES | | |
| reviewed_at | DateTime | YES | | |
| created_at | DateTime | NO | now() | |

**UniqueConstraint**: `(events_id, sports_id, organization_id)` — `uix_event_sport_org`

### Model: `participation_per_sport`
- **File**: `backend/src/models/participation_per_sport.py:8`
- **Table**: `participation_per_sport`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| sports_Events_id | Integer | YES (indexed) | | FK -> sports_event_org.id (SET NULL) |
| org_id | Integer | YES (indexed) | | FK -> organizations.id (SET NULL) |
| athlete_female_count | Integer | YES | 0 | |
| leader_female_count | Integer | YES | 0 | |
| athlete_male_count | Integer | YES | 0 | |
| leader_male_count | Integer | YES | 0 | |
| status | String(32) | NO | 'SUBMITTED' | |
| review_note | String (unbounded) | YES | | |
| reviewed_at | DateTime | YES | | |
| created_at | DateTime | NO | now() | |

### Model: `team`
- **File**: `backend/src/models/team.py:7`
- **Table**: `teams`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| event_id | Integer | NO (indexed) | | FK -> events.id (CASCADE) |
| sport_id | Integer | NO | | FK -> sports.id (CASCADE) |
| org_id | Integer | NO | | FK -> organizations.id (CASCADE) |
| category_id | Integer | YES | | FK -> categories.id (SET NULL) |
| name | String(200) | NO | | |
| created_at | DateTime | NO | now() | |

**Relationships**: `event` (joined), `sport` (joined), `organization` (joined), `category_obj` (joined)

### Model: `Medal`
- **File**: `backend/src/models/medal.py:10`
- **Table**: `medals`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement (indexed) | |
| athlete_participation_id | Integer | YES (indexed) | | FK -> athlete_participation.id (SET NULL) |
| medal_type | medal_typeEnum | NO | 'none' | |
| key_performance | String(255) | YES | | |
| created_at | DateTime | NO | now() | |

### Model: `UploadedFile`
- **File**: `backend/src/models/uploaded_file.py:12`
- **Table**: `uploaded_files`

| Field | Type | Nullable | Default |
|---|---|---|---|
| id | UUID | NO | uuid4() |
| filename | String(255) | YES | |
| content_type | String(100) | NO | |
| size | Integer | NO | |
| data | LargeBinary | NO | |
| uploaded_by | UUID | YES | |
| created_at | DateTime(tz) | NO | now() |

### Model: `OrganizerRole`
- **File**: `backend/src/models/organizer_role.py:13`
- **Table**: `organizer_roles`

| Field | Type | Nullable | Default |
|---|---|---|---|
| id | Integer | NO | autoincrement |
| name_kh | String(200) | NO | |
| name_en | String(200) | NO | |
| active | Boolean | NO | true |

### Model: `OrganizerParticipation`
- **File**: `backend/src/models/organizer_participation.py:8`
- **Table**: `organizer_participation`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | autoincrement | |
| enroll_id | Integer | NO (indexed) | | FK -> enrollments.id (CASCADE) |
| event_id | Integer | NO (indexed) | | FK -> events.id (CASCADE) |
| organization_id | Integer | YES | | FK -> organizations.id (SET NULL) |
| organizer_role_id | Integer | NO | | FK -> organizer_roles.id (RESTRICT) |
| created_at | DateTime | NO | now() | |

**Relationships**: `enroll` (many-to-one)

### Model: `OpenSurveyField`
- **File**: `backend/src/models/open_survey.py:8`
- **Table**: `open_survey_fields`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | | |
| event_id | Integer | NO (indexed) | | FK -> events.id (CASCADE) |
| label_kh | String(255) | NO | | |
| label_en | String(255) | YES | | |
| field_type | String(50) | NO | 'text' | |
| options | JSON | YES | | |
| required | Boolean | NO | true | |
| sort_order | Integer | NO | 0 | |
| active | Boolean | NO | true | |
| created_at | DateTime | NO | now() | |

**Relationships**: `event` (many-to-one, backref="open_survey_fields"), `responses` (one-to-many, backref="responses")

### Model: `OpenSurveyResponse`
- **File**: `backend/src/models/open_survey.py:31`
- **Table**: `open_survey_responses`

| Field | Type | Nullable | Default | FK |
|---|---|---|---|---|
| id | Integer | NO | | |
| field_id | Integer | NO (indexed) | | FK -> open_survey_fields.id (CASCADE) |
| organization_id | Integer | NO (indexed) | | FK -> organizations.id (CASCADE) |
| value | Text | YES | | |
| created_at | DateTime | NO | now() | |
| updated_at | DateTime | YES | onupdate=now() | |

**Relationships**: `field` (many-to-one, backref="responses"), `organization` (many-to-one, backref="open_survey_responses")

---

## 1.2 Migration History vs. Current Model State

### Migration Chain (in order of application):
```
425f25068de6 (initial schema)
  -> 01e2671a48d6 (failed_attempts + locked_until)
    -> 834864ee56c1 (search_text column)
      -> a1b2c3d4e5f6 (athlete_participation index)
        -> b2c3d4e5f6a7 (uploaded_files table)
          -> d58f7c21045b (MIXED gender enum value)
            -> b3f1a82c9d70 (Phase 2: sport config + participant_cap)
              -> 757ed5271195 (name_en on organizations)
                -> c4d5e6f7g8h9 (Phase 3: teams)
                  -> d5e6f7g8h9i0 (Phase 4: organizers)
                    -> e6f7g8h9i0j1 (Phase 5: open survey)
```

### Tables Auto-Created (not in any migration)
Several tables exist in the model but are **never explicitly created by an Alembic migration**. They are created at runtime via `Base.metadata.create_all()` in the maintenance sync-schema endpoint or on first app startup:
- `sports_event_org` — only indexed in migration `425f25068de6`
- `participation_per_sport` — only indexed in migration `425f25068de6`

This means these tables' column types come directly from the SQLAlchemy model definitions, not from any migration. The model's `String(32)` for `participation_per_sport.status` becomes `VARCHAR(32)` in PostgreSQL — there is no type length mismatch.

### Flagged Issue
1. **`participation_per_sport` table has no dedicated migration** — The table and its columns (`sports_Events_id`, `org_id`, `status`, `review_note`, `reviewed_at`, etc.) are never created by Alembic. They rely entirely on `Base.metadata.create_all()`. The maintenance route (`maintenance.py:48-66`) adds `status`, `review_note`, and `reviewed_at` via raw SQL as `ADD COLUMN IF NOT EXISTS` — which is a no-op if `create_all` already created them. If `create_all` hasn't run, the maintenance route alone creates these columns but NOT the `sports_Events_id` or `org_id` FK columns (those require the table to exist first).
