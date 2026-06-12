# AGENT PROMPT — build the COMPLETE functional system (choschmous)

> Paste this into Claude Code opened at the root of the choschmous repo.
> Companion spec: `Functional System Design.html` (put it in the repo root too — it contains the
> full rationale, coverage map, and report layouts). This prompt is self-sufficient for the build,
> but read the spec FIRST for context.

---

You are completing the functional system of THIS repository — a MoEYS sports-event management
platform. Stack: **backend/** FastAPI + SQLAlchemy (async) + Alembic + Postgres; **frontend/**
Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn-style primitives in `src/shared/ui` +
`lucide-react` + `next-intl` (`src/messages/{en,kh}.json`). Auth = HttpOnly-cookie JWT; roles
`SUPER_ADMIN / ADMIN / ORGANIZATION / FEDERATION`; org scoping via `get_effective_org_id` +
`enforce_org_access` in `backend/src/database/deps.py`.

**What already works — do NOT rebuild, build on top:**
- `Events` model with 4 phase gates (`survey_category`, `survey_sport`, `survey_number`,
  `registration`), each AUTO/OPEN/CLOSED + date window + computed `*_is_open`;
  `PATCH /events/{id}/phase`; `GET /events?<phase>_open=true` filters.
- Survey by sport: `POST /events/add-org-to-sport` → `sports_event_org`; FE `modules/bysport`.
- Survey by number: `participation_per_sport` (M/F athlete+leader counts) with review FSM
  (DRAFT→SUBMITTED→APPROVED/REJECTED/FLAGGED/REVISION_REQUESTED) + `PATCH /{id}/review`;
  FE `modules/bynumber` wizard.
- Registration: `POST /registration` (Athlete needs categoryId; Leader needs leaderRole),
  `Enroll` with KH/EN names, gender, DoB, phone, address, photo + 4 document paths;
  filters role/event/sport/org/leader_roles/search; PII masking + audited reveal; idempotency;
  rate limits. FE `modules/register`, `modules/leader-registration` (registrations list + detail).
- `categories` table per (event, sport, category, gender) with unique constraint.
- Excel: `/excel/org-sport`, `/excel/org-sport-participant`. Cards, files, cloudinary, dashboard.

Work in **5 phases, in order**. Each phase: migrate → backend (service + routes + tests) →
frontend → `alembic upgrade head`, backend tests, `next build` + lint must pass → small commits
on branch `feat/functional-system`. **Stop and show me a plan + file list before each phase.**

---

## PHASE 1 — Federation→sport binding + Survey by Category flow

**Schema:** add `users.sport_id` (nullable FK → sports.id; set only for FEDERATION users).
Alembic migration + seed update.

**Backend:**
- New dep `get_effective_sport_id(current_user, sport_id)` mirroring `get_effective_org_id`:
  FEDERATION users are forced to their own `sport_id`; admin may pass any; ORGANIZATION → 403.
- `POST /surveys/category` — body `{event_id, sport_id, categories: [{name, gender}]}`.
  Upserts `categories` rows for (event, sport); deletes rows removed from the list. Gate on
  `event.survey_category_is_open` (403 with clear detail if closed). Federation-scoped.
- `GET /surveys/category?event_id&sport_id` — current list (used for edit/resubmit + admin view).

**Frontend** (`modules/bycategory`, route `by-category` — currently a stub):
4-step wizard like `bynumber`: ① select event (only `survey_category_open=true`) → ② sport is
auto-resolved from the federation account (show as a locked card) → ③ manage category list —
add/edit/remove rows of (category name KH, gender M/F/mixed), with a "copy from previous event"
helper that pre-fills from the most recent event having categories for this sport → ④ review +
submit. Reuse `StepIndicator`, `Card`, `radio-card` primitives. i18n keys in both `en.json` + `kh.json`.

## PHASE 2 — Sport-event config + registration validation rules

**Schema:** on `sports_events` add: `mode` enum(`individual`,`team`,`both`) default `individual`;
`team_size_min` int null; `team_size_max` int null; `quota_athletes_per_org` int null;
`quota_teams_per_org` int null. Optional: `events.participant_cap` int null.

**Backend:**
- `PATCH /sports-events/{id}/config` (require_staff) to set the above; include config in
  `GET /events/{id}/sports` response schema.
- `GET /events/{event_id}/my-eligible-sports` — sports this org selected in survey ② (from
  `sports_event_org`), with config attached. Org-scoped.
- **Validation in `ParticipantService.register_participant`** (server-side, with precise error
  details the UI can localize):
  1. `event.registration_is_open` must be true.
  2. **Age rule** (athletes): `age_mode=BIRTH_YEAR` → birth year within [age_min, age_max
     interpreted as years]; `EXACT_AGE` → age at `event.start_date` within [age_min, age_max].
     Error includes the allowed range.
  3. **Document rule**: age < 18 at event start → `birth_certificate` upload required;
     age ≥ 18 → at least one of `national_id` / `passport`. Reject otherwise.
  4. **Quota**: count current athletes for (org, event, sport) against
     `quota_athletes_per_org`; reject when full.
  5. **Soft duplicate**: same (kh names + DoB) already enrolled in this event → return 409 with
     `duplicate_suspect: true`; allow override via explicit `force: true` field.
  6. **Sport eligibility**: sport must be in the org's survey-② selections; category must exist
     in `categories` for (event, sport).

**Frontend** (`modules/register`): wire the cascade — event step filters `registration_open`,
sport step calls `my-eligible-sports`, category step calls
`/events/{id}/sports/{sportId}/categories` (skip for leaders). Dynamic document slots per the
age rule, inline plain-language errors (KH/EN), quota meter "14/23" in the wizard header,
duplicate-warning dialog with override.

## PHASE 3 — Teams

**Schema:** `teams` (id, event_id FK, sport_id FK, org_id FK, category_id FK null, name varchar,
created_at); add `athlete_participation.team_id` (nullable FK).

**Backend:** `POST /teams` (validates mode allows team, quota_teams_per_org, uniqueness per
org+event+sport+category), `GET /teams?event_id&org_id`, `POST /teams/{id}/members` (runs the
full Phase-2 per-person validation + team_size_max), `DELETE /teams/{id}/members/{enroll_id}`,
`GET /teams/{id}` (roster with member completeness). Org-scoped throughout.

**Frontend:** in the register wizard, after category: mode chooser (Individual / Team — show
only what config allows). Team path: create-or-pick team → roster screen (member cards with
add/edit/remove, per-member validation status chips, live "members 9 / min 11 – max 18") →
review whole roster → submit. Block submit below `team_size_min`.

## PHASE 4 — Organizer registration + admin filter completion

**Schema:** `organizer_roles` lookup (id, name_kh, name_en, active bool) seeded with:
head_of_delegation, deputy_head_of_delegation, member, team_leader, technical_official,
referee, medical, security, media, volunteer. New `organizer_participation`
(id, enroll_id FK, event_id FK, org_id FK null, organizer_role_id FK, created_at).

**Backend:** `POST /registration/organizer` (same Enroll person record + document/age handling;
event-level — no sport/category); `GET /organizer-roles` (+ admin CRUD: POST/PATCH to
activate/deactivate); extend `GET /registration` with `category_id` and `gender` filters and an
`organizer` role option so the list covers athletes / leaders / organizers uniformly.

**Frontend:** organizer wizard (event → person form → role dropdown from `/organizer-roles` →
review); registrations list gains category + gender + organizer-role filters; admin screen to
manage organizer roles (simple table + add/disable).

## PHASE 5 — Reports engine + survey completion board

**Backend:**
- `GET /events/{id}/survey-status` — matrix: every org × (survey ② submitted?, survey ③ status
  from the FSM) and every federation-bound sport × (survey ④ category count). Admin only.
- `GET /reports/{key}?event_id=&org_id=&format=xlsx|pdf` with
  `key ∈ {sport-list, totals, counts, album, name-list, leaders, coach-athlete, delegation}`.
  One `ReportService` producing language-neutral row data per key; two renderers:
  **xlsx** (openpyxl) and **pdf** (HTML template → WeasyPrint or Playwright print; MUST embed a
  Khmer font — Kantumruy Pro — and render Khmer numerals ១២៣ in the template layer).
  Org users auto-scope to own org. Column layouts (each gendered column splits into M/F):
  1. `sport-list` ចុះប្រភេទកីឡា — survey ②+③ per sport: ល.រ / ប្រភេទកីឡា / បុរស✓ / នារី✓
  2. `totals` ចំនួនរួម — per org: ប្រតិភូ / អ្នកដឹកនាំ / គ្រូ / one col per sport / សរុបអត្តពលិក /
     សរុបប្រតិភូ; `?source=planned|actual` (survey ③ vs live registrations)
  3. `counts` ចុះចំនួន — survey ③ per sport: ល.រ / ប្រភេទកីឡា / ប្រតិភូ / ដឹកនាំ / គ្រូបង្វឹក /
     អត្តពលិក / សរុប / សរុបរួម
  4. `album` អាល់ប៊ុម — full detail per org incl. photo, grouped leadership → athletes:
     គោត្តនាម-នាម / ភេទ / សញ្ជាតិ / ឈ្មោះឡាតាំង / ថ្ងៃខែឆ្នាំកំណើត / តួនាទី / អាសយដ្ឋាន /
     លេខអត្តសញ្ញាណប័ណ្ណ / លេខទូរស័ព្ទ
  5. `name-list` រាយនាមរួម — ល.រ / គោត្តនាម-នាម / ភេទ / ថ្ងៃខែឆ្នាំកំណើត / សញ្ជាតិ /
     អត្តសញ្ញាណប័ណ្ណ / តួនាទី / ប្រភេទកីឡា / ផ្សេងៗ
  6. `leaders` ថ្នាក់ដឹកនាំ — leaders/special roles per sport per org (same minus ID)
  7. `coach-athlete` គ្រូបង្វឹក អត្តពលិក — ល.រ / គោត្តនាម-នាម / ភេទ / DoB / Categories / តួនាទី
     (គ្រូបង្វឹក, គ្រូជំនួយ, កីឡាករ, កីឡាការិនី)
  8. `delegation` ប្រតិភូ អ្នកដឹកនាំ — Head/Deputy/Member/Team-leader per org per sport
     (uses Phase-4 roles)

**Frontend:** `reports` page → pick event → report cards (8) → filter panel (org, planned/actual
where relevant) → Download xlsx / pdf buttons; `events/[eventId]` admin page gains the survey
completion board (table of orgs/federations × status chips reusing the FSM badge styles).

---

## Hard rules
- Never weaken org-scoping: every new endpoint uses `get_current_user` + the same
  `enforce_org_access` / `get_effective_org_id` (and the new sport equivalent) patterns.
- All validation is **server-side first**; frontend mirrors it for UX. Error responses use
  structured `detail` (code + params) so the UI can localize KH/EN.
- Khmer-first UI: every new string goes in BOTH `messages/en.json` and `messages/kh.json`.
- Gender-role naming: store `role` + `gender`; render កីឡាករ/កីឡាការិនី from the pair — never a
  separate input.
- Follow existing code patterns (service classes, repository/adapter split in FE modules,
  rate limiters on writes, idempotency on registration writes).
- Alembic migration per phase, reversible. No destructive changes to existing tables.
- UI follows the existing design tokens in `src/app/globals.css` (brand `#1B4B65`) and the shared
  primitives — no new colors, no one-off styles.

## Acceptance (whole build)
- A federation account can submit categories only for its own sport; org accounts see in the
  register wizard ONLY their surveyed sports and ONLY federation-defined categories.
- Underage/overage DoB is rejected with the allowed range; <18 without birth cert rejected;
  ≥18 without NID/passport rejected; quotas and team sizes enforced.
- Organizers registrable with extensible roles; admin list filters by org/sport/category/
  gender/role across athletes+leaders+organizers.
- All 8 reports download as both xlsx and pdf with correct Khmer text and M/F splits.
- Survey board shows per-org/per-federation completion at a glance.
- `alembic upgrade head` clean; backend tests green; `next build` + lint clean; no console errors.

Begin with Phase 1: read the spec + relevant code, then present your plan and file list.
