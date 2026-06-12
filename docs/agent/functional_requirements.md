# CHOSCHMOUS · MOEYS Sports Management System
## Functional Requirements Specification
> Grounded in the actual codebase — verified against `backend/src` (FastAPI) and `frontend/src` (Next.js 16) · June 2026

---

## Table of Contents

1. [Actors & Permissions](#1-actors--permissions)
2. [Event Lifecycle (4 Phases)](#2-event-lifecycle--4-phases)
3. [Scenario Coverage Map](#3-scenario-coverage-map)
4. [Flow Designs](#4-flow-designs)
5. [Admin Overview & Filters](#5-admin-overview--filters)
6. [Reports Engine (8 Documents)](#6-reports-engine--8-documents)
7. [Data Model Additions](#7-data-model-additions)
8. [API Additions](#8-api-additions)
9. [Build Order](#9-build-order)

---

## 1. Actors & Permissions

The backend defines three roles (`UserRole`): `SUPER_ADMIN` / `ADMIN` (Ministry), `ORGANIZATION` (province / school / club), and `FEDERATION` (per-sport federation). Org-scoping is enforced server-side via `get_effective_org_id` + `enforce_org_access` — org users can never act on another org.

| Capability | Admin (Ministry) | Organization | Federation |
|---|---|---|---|
| Create event, set phases & dates, manage sports/quota | ✔ | — | — |
| Survey by sport (select sports the org joins) | View all | ✔ own org | — |
| Survey by number (participant counts per sport) | View + review/approve | ✔ own org | — |
| Survey by category (categories offered per sport) | View all | — | ✔ own sport only |
| Register athletes & team leaders | ✔ any org | ✔ own org | — |
| Register organizers (event staff) | ✔ | ✔ own organizer team | — |
| Overview, filters, exports (PDF / Excel) | ✔ all orgs | Own-org only | Own-sport only |

> **Gap:** FEDERATION users have no `sport_id` binding in the user model — "volleyball federation sees only volleyball" cannot be enforced yet. See [§7-A](#7-data-model-additions).

---

## 2. Event Lifecycle — 4 Phases

The `Events` model implements the concept "creating an event automatically creates all surveys": every event carries four phase gates as columns — `survey_category`, `survey_sport`, `survey_number`, `registration` — each with status `AUTO / OPEN / CLOSED`, an open/close date window, and computed `*_is_open` flags.

- `PATCH /events/{id}/phase` (admin-only) opens/closes any phase.
- `GET /events?survey_sport_open=true` filters events by open phase.

### Phase Order

> Enforce as a **soft sequence** — warn, don't hard-block.

```
① Survey by category (Federation)
  → ② Survey by sport (Org)
    → ③ Survey by number (Org)
      → ④ Registration (Org)
        → ⑤ Reports (Admin)
```

### Event Setup Data (Already Supported)

| Field | Values |
|---|---|
| Type | កីឡាជាតិ / ឧត្តមសិក្សា / មធ្យមសិក្សា / បឋមសិក្សា |
| Dates | Start / End |
| Location | Free text |
| Age rule | `age_mode = BIRTH_YEAR` or `EXACT_AGE` + min/max |

The age rule is the basis for anti-age-faking validation at registration time.

---

## 3. Scenario Coverage Map

> **BUILT** = working end-to-end · **PARTIAL** = backbone exists, rules missing · **MISSING** = needs new build

| # | Scenario | Status | Evidence in Code |
|---|---|---|---|
| 1 | Admin creates event + phases + global sports added to event | **BUILT** | `POST /events`, `PATCH /events/{id}/phase`, `POST /events/add-sport`; sports are global (`sports` table) and linked per event (`sports_events`) |
| 1b | Team-vs-alone flag, team size & quota per sport/event | **MISSING** | No quota / team fields on `sports_events` |
| 2 | Survey by sport (org multi-selects sports) | **BUILT** | FE `modules/bysport` wizard; BE `POST /events/add-org-to-sport` → `sports_event_org` |
| 3 | Survey by number (org inputs counts table) | **BUILT** | FE `modules/bynumber` (event step → table → review → success); BE `participation_per_sport` with M/F athlete + leader counts and admin review FSM (`DRAFT→SUBMITTED→APPROVED/REJECTED/…`) |
| 4 | Survey by category (federation selects categories per sport) | **PARTIAL** | `categories` table is per `event+sport(+gender)` with unique constraint; FE by-category page is a stub; no federation→sport scoping |
| 5 | Register participant (athlete/leader, cascading filters, docs) | **PARTIAL** | `POST /registration` handles Athlete (needs `categoryId`) + Leader (needs `leaderRole`); enroll stores KH+EN names, gender, DoB, phone, address, photo + 4 document paths. Cascade endpoints exist (`/events/{id}/sports`, `.../categories`, `.../orgs`) |
| 5b | Age-range validation · document rule (<18 birth cert; ≥18 NID/passport ≥1) · team registration | **MISSING** | Fields exist; the conditional rules & any team grouping do not |
| 6 | Register organizer (event-level staff, many technical roles) | **PARTIAL** | FE `leader-registration` route exists; `LeaderRole` enum has only 6 roles, all team-scoped — no event-level organizer concept |
| 7 | Admin overview + filters + export | **PARTIAL** | `GET /registration` filters: role, event, sport, org, leader_roles, search. No category or gender filter. Survey-completion overview missing. Excel: 2 endpoints (`/excel/org-sport`, `/excel/org-sport-participant`); PDF: none |
| 8 | 8 Khmer report documents | **MISSING** | All source data exists in DB; report composition & export pipeline do not (see §6) |

> **Summary:** The event phase machine, both org surveys (incl. an approval workflow), org-scoped security, PII masking/audit, idempotent registration, and rate-limiting are production-grade. Work is concentrated in: quota/team config (§7-B), category survey UX + federation scoping (§4-④, §7-A), registration validation rules (§4-⑤), organizer roles (§7-C), and the reports engine (§6).

---

## 4. Flow Designs

### Flow ① — Admin: Create Event & Configure

**Actor:** Admin

| Step | Action |
|---|---|
| 1 | Event info: name KH/EN · type · dates · location · age rule |
| 2 | Phase windows: 4 phases · AUTO dates or force OPEN/CLOSED |
| 3 | Add sports: pick from global list · per-sport config *(new — see §7-B)* |
| 4 | Review & create |

**Step 3 per-sport config (§7-B):**
- Mode: individual / team / both
- Team size: min–max members per team (e.g. football 18–23)
- Quota: max athletes per org in this sport, max teams per org
- Event-level participant cap

Phase windows default to `AUTO` with the dates entered; the admin event page gets four status pills with quick open/close (already supported by `PATCH /phase`).

---

### Flow ② — Organization: Survey by Sport

**Actor:** Organization · **Status: BUILT**

| Step | Action |
|---|---|
| 1 | Select event (only `survey_sport_open`) |
| 2 | Multi-select sports (sport grid · search) |
| 3 | Review + submit |

**Addition required:** Show resubmission state — if the org already submitted, open in edit mode with current selections and a "last submitted" timestamp.

---

### Flow ③ — Organization: Survey by Number

**Actor:** Organization · **Status: BUILT**

| Step | Action |
|---|---|
| 1 | Select event (only `survey_number_open`) |
| 2 | Counts table: rows = sports from survey ② · columns = athlete M/F, leader M/F |
| 3 | Review + submit |
| 4 | Admin review: approve / reject / request revision |

The table must only list sports the org selected in survey ② (data: `sports_event_org`). The review FSM already exists — surface it: org sees status chips (Submitted / Approved / Revision requested + note), admin gets a review queue (§5).

---

### Flow ④ — Federation: Survey by Category

**Actor:** Federation · **Status: PARTIAL → Design**

| Step | Action |
|---|---|
| 1 | Select event (only `survey_category_open`) |
| 2 | Own sport auto-resolved from federation→sport binding |
| 3 | Define / select categories: name + gender (M/F/mixed) · add, edit, remove |
| 4 | Review + submit |

**Requirements:**
- Categories are stored per `(event, sport, category, gender)` — already the right shape.
- A reusable "category library" per sport (copy from last event) saves re-typing each year.
- Requires **§7-A** federation→sport binding.
- Volleyball federation must **never** see football categories.

---

### Flow ⑤ — Organization: Register Participant

**Actor:** Organization · **Status: PARTIAL → Design**

This is the heart of the system and the anti-age-faking control point. The wizard gains cascading eligibility — each step only offers what upstream surveys allow:

| Step | Action |
|---|---|
| 1 | Select event (only `registration_open`) |
| 2 | Sport (only sports THIS org selected in survey ②) |
| 3 | Category (only categories the federation defined in survey ④ · skip for leaders) |
| 4 | Mode: individual / team (per sport config) |
| 5 | Person form(s) |
| 6 | Review + submit |

#### Validation Rules (server-side, mirrored inline in UI)

| Rule | Behavior |
|---|---|
| **Age window** | DoB must satisfy the event's `age_mode` + min/max (`BIRTH_YEAR`: birth-year bounds, e.g. "born ≥ 2008"; `EXACT_AGE`: age at event start). Hard block with plain-language Khmer error showing the allowed range. Applies to athletes; leaders exempt unless configured. |
| **Documents** | Age < 18 → birth certificate required. Age ≥ 18 → at least one of national ID / passport (birth cert optional extra). The upload step shows only the relevant slots, marked required dynamically. Enforce again in `ParticipantService`. |
| **Gender-role naming** | Role label derives from gender automatically: athlete + M → កីករ, athlete + F → កីការិនី (store role + gender; render the Khmer label, never ask twice). |
| **Team mode** | One team record per `(event, sport, org [, category])`; members added under it with the same per-person validation. Member count enforced against the sport's min/max (§7-B). Roster screen = add/edit/remove members with per-member completeness chips, then submit the whole roster at once. |
| **Quota** | On submit, count existing registrations for `(org, event, sport)` against quota; clear error when full. Show live "14 / 23 places used" in the wizard header. |
| **Duplicates** | Soft duplicate check on `(name KH + DoB)` within the event → warn "possibly already registered", allow override with note. `Idempotency-Key` already supported — keep it. |

---

### Flow ⑥ — Register Organizer (Event Staff)

**Actor:** Admin / Organization · **Status: PARTIAL → Design**

| Step | Action |
|---|---|
| 1 | Select event (only `registration_open`) |
| 2 | Person form (same fields + same doc rules) |
| 3 | Role (organizer role list — see §7-C) |
| 4 | Review + submit |

**Requirements:**
- Organizers are event-level (no sport/category).
- Reuse the same `enroll` record and person form.
- Separate participation type so overview filters and reports can distinguish them (§7-C).
- Role list is **admin-extensible** (technical official, referee, medical, security, media, …) rather than a hard-coded enum.

---

## 5. Admin Overview & Filters

**Actor:** Admin

### Survey Completion Board *(new)*
A matrix of orgs × (survey ② done?, survey ③ status) and federations × (survey ④ done?) — instantly shows who hasn't responded. Must be exportable.

### Review Queue
Pending survey-③ submissions with approve / reject / request-revision (+ mandatory note). Endpoint exists; needs the screen.

### Participants List
Existing list + add `category` and `gender` filters to `GET /registration`. Every filtered view must be exportable.

### Organizers List
Same list filtered to organizer type, plus role filter.

---

## 6. Reports Engine — 8 Official Documents

All eight documents are compositions of data that already exists once the §4 flows run. Build one report service (server-side) with two renderers:

- **Excel:** `openpyxl` (already a dependency pattern via `/excel`)
- **PDF:** HTML template → headless render (Khmer fonts **must** be embedded — Kantumruy Pro)

Every report takes `event_id` (+ optional `org` filter) and returns the official layout with M/F split columns.

**Endpoint design:**
```
GET /reports/{key}?event_id=&org_id=&format=pdf|xlsx
```

Where `key` ∈ `{sport-list, totals, counts, album, name-list, leaders, coach-athlete, delegation}`.

> Khmer numerals (១២៣) and labels live in the template layer; data layer stays language-neutral. Reports for org users auto-scope to their own org.

---

| # | Document | Composition (Source → Columns) |
|---|---|---|
| ១ | **ចុះប្រភេទកីឡា** — បញ្ជីចុះឈ្មោះប្រភេទកី | Survey ② + ③ joined per sport → ល.រ · ប្រភេទកី · បុរស ✓ · នារី ✓ |
| ២ | **ចំនួនរួម** — តារាងទិន្នន័យក្រុមចូលរួម | Per organization → ប្រតិភូ · អ្នកដឹកនាំ · គ្រូ · one column per sport · សរុបអត្តពលិក · សរុបប្រតិភូ — every column split M/F. Toggle "planned vs actual". |
| ៣ | **ចុះចំនួន** — បញ្ជីចំនួនតាមប្រភេទកី | Survey ③ per sport → ល.រ · ប្រភេទកី · ប្រតិភូ · ដឹកនាំ · គ្រូបង្វឹក · អត្តពលិក · សរុប · សរុបរួម, each split M/F |
| ៤ | **អាល់ប៊ុម** — អាល់ប៊ុមប្រតិភូ…កីការិនី | Full enroll records per org, grouped ថ្នាក់ដឹកនាំ → កីករ/កីការិនី → គោត្តនាម-នាម · ភេទ · សញ្ជាតិ · ឈ្មោះតាំង · ថ្ងៃខែឆ្នាំកំណើត · តួនាទី · អាសយដ្ឋាន · លេខអត្តសណ្ណប័ណ្ណ · លេខទូរស័ព្ទ + photo (`photo_path` exists) |
| ៥ | **រាយនាមរួម** | All participants per org, all sports → ល.រ · គោត្តនាម-នាម · ភេទ · ថ្ងៃខែឆ្នាំកំណើត · សញ្ជាតិ · អត្តសណ្ណប័ណ្ណ · តួនាទី · ប្រភេទកី · ផ្សេងៗ |
| ៦ | **ថ្នាក់ដឹកនាំ** | Leaders / special roles per sport per org → same columns minus ID, plus ប្រភេទកី |
| ៧ | **គ្រូបង្វឹក អត្តពលិក** | Coaches + athletes per sport → ល.រ · គោត្តនាម-នាម · ភេទ · DoB · Categories · តួនាទី (គ្រូបង្វឹក / គ្រូជំនួយ / កីករ / កីការិនី) |
| ៨ | **ប្រតិភូអ្នកដឹកនាំ** | Delegation leadership per org per sport → Head of Delegation · Deputy Head · Member · Team Leader (requires §7-C roles) |

---

## 7. Data Model Additions

> Small, surgical changes only.

| # | Addition | Shape |
|---|---|---|
| **A** | **Federation → sport binding** | `users.sport_id` (nullable FK, set for `FEDERATION` role) — or a `federation_sports` join table if one federation may own several sports. Enforce in deps like `enforce_org_access`. |
| **B** | **Sport-event config** | On `sports_events`: `mode` (individual\|team\|both) · `team_size_min/max` · `quota_athletes_per_org` · `quota_teams_per_org`. Optional `events.participant_cap`. |
| **C** | **Organizer participation + roles** | New `organizer_participation` (`enroll_id`, `event_id`, `organizer_role_id`, `org_id`) + `organizer_roles` lookup table (admin-extensible; seed: `head_of_delegation`, `deputy_head`, `member`, `team_leader`, `technical_official`, `referee`, `medical`, …). Also extend delegation roles used by report ៨. |
| **D** | **Team** | `teams` (`event_id`, `sport_id`, `org_id`, `category_id`, `name`) + `athlete_participation.team_id` (nullable FK — individuals stay null). |

---

## 8. API Additions

| Endpoint | Purpose |
|---|---|
| `GET /events/{id}/my-eligible-sports` | Sports this org selected in survey ② (drives wizard step 2) |
| `PATCH /sports-events/{id}/config` | Admin sets mode / team size / quota (§7-B) |
| `POST /surveys/category` | Federation category survey submit (writes `categories` rows, federation-scoped) |
| `GET /surveys/category?event_id=&sport_id=` | Federation category survey read |
| `GET /events/{id}/survey-status` | Survey completion board: orgs × surveys ②③, federations × survey ④ |
| `POST /teams` | Create team record with size/quota validation |
| `POST /teams/{id}/members` | Add member to team roster |
| `POST /registration/organizer` | Organizer registration (event-level, `organizer_role`) |
| `GET /registration?category_id=&gender=` | Complete the admin filter set (org/sport/category/gender/role) |
| `GET /reports/{key}?format=pdf\|xlsx` | The 8 documents (§6) — one service, two renderers |

---

## 9. Build Order

> Each phase ships value independently.

| Phase | Scope | Rationale |
|---|---|---|
| **1** | §7-A federation binding + flow ④ category survey UI | Unblocks the only survey with no real UI; small schema change |
| **2** | §7-B sport config + flow ⑤ validation rules (age, docs, quota, cascade) | The anti-fraud core; registration becomes trustworthy |
| **3** | §7-D teams + team roster flow | Builds on phase 2; needed before team sports register |
| **4** | §7-C organizer roles + flow ⑥ + admin filter completion (§5) | Independent of teams; completes the people inventory |
| **5** | §6 reports engine (Excel first, PDF second) + survey completion board | Needs phases 1–4 data to be meaningful; highest Ministry visibility |

---

> **Design note:** Every flow above uses the redesigned portal language — the 5-step wizard pattern (flows ②③④⑤⑥ are all "select event → choose → fill → review → submit"), the sport multi-select grid, radio-card categories, status badges for the review FSM, and the table/toolbar pattern for §5 overviews. One system, one visual vocabulary.
