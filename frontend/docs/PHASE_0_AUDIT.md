# Phase 0 — Frontend Hardening Audit

**Standard:** `.claude/skills/national-frontend-architecture/` (SKILL.md + 5 references).
**Date:** 2026-06-03 · **Branch:** `main` · **Scope:** `frontend/` (`modules/`, `core/`, `shared/`, `app/`, `messages/`).
**Status:** AUDIT ONLY — no source files were changed. (This report is the only file added.)

> This system holds citizen/athlete PII (incl. potentially **minors**) and official records.
> Defects are ranked: **SECURITY/DATA → ARCHITECTURE → HYGIENE**.

---

## 0. Executive summary

| Dimension | State |
|---|---|
| Ports & Adapters | **Absent in all 14 modules.** Legacy `services/` → `apiClient` everywhere. |
| Zod response validation | **0 of 14** service files parse responses (Golden Rule 12 violated globally). |
| Auth tokens | ✅ httpOnly cookies (`withCredentials`) — **not** in JS storage. |
| Auth PII | ❌ Full `User` (email, names, photo, org) persisted to `localStorage`. |
| Capability hook (`usePermissions`) | **Does not exist.** Authz via inline `role ===` / `useAuth().hasRole`. |
| QueryKeys registry | **Does not exist.** 49 hardcoded `queryKey:` arrays. |
| CSRF / correlation ID | **None** in `apiClient`. |
| `queryClient.clear()` on logout | **Missing.** |
| i18n key parity (en/kh) | ✅ 564 keys each, **0 diff** — Phase 1 parity check already passes. |
| `dangerouslySetInnerHTML` | ✅ None. |
| Secrets in `NEXT_PUBLIC_` | ✅ Only public values (API/app URL, Cloudinary cloud name). |
| `any` | ✅ Effectively clean (2 `z.any()` on optional numeric fields). |
| `console.*` | ❌ ~49 occurrences, several logging payloads / raw API error bodies. |

---

## 1. Module inventory & target-folder gaps

Target folders required by the standard: `ports/ adapters/ api/ schema/ mappers/ store/`.
**Every module is missing all six** — all are in the legacy `hooks/ services/ components/ types/` layout.

| Module | Files | Hook files | Largest files (lines) | Has `services/schema.ts`? |
|---|---|---|---|---|
| events | 27 | **15** | services/index.ts (377), EventList (341), EventForm (338), EventDetailPage (205) | no |
| sports | 22 | **10** | CategoryParticipants (240), services/index.ts (194), CategoryList (115) | no |
| registration | 16 | 3 | RegisterFormFields (538), RegisterForm (220), types (168), schema (120) | **yes** |
| survey | 14 | 2 | SurveyForm (223), SurveyFormFields (217), services (189) | **yes** |
| participation | 13 | 3 | SubmissionDetail (225), ParticipationList (148) | no |
| organizations | 12 | 4 | OrgList, OrgForm | no |
| bynumber | 12 | 2 | ByNumberFormFields (347), services (241), ByNumberForm (206) | **yes** |
| users | 12 | 4 | UserForm (183) | no |
| cards | 11 | 2 | CardGrid (130) | no |
| dashboard | 11 | 1 | — | no |
| reports | 8 | 1 | ReportList (159), ReportGenerateModal (159) | no (also no `types/`) |
| auth | 5 | — | LoginForm (128) | no (only `components/`) |
| home | 5 | — | HomePage (157) | no |
| common | 6 | — | Sidebar (258) | no |

**Per-module action:** create `ports/ + adapters/ (+index.ts) + mappers/ + store/`; rename `services/ → api/`; add `schema/` (move the 3 existing `services/schema.ts` for registration/survey/bynumber).

---

## 2. 🔴 SECURITY / DATA violations (highest)

### S1 — PII persisted in `localStorage`
`core/auth/context/AuthContext.tsx:55-61` (`writeCache`) stores the full `User` object under key `auth_user_cache`: email, `kh_*`/`en_*` names, `photo_path`, `org_id`, `sport_id`. Read at `:45-53`, `:137`, `:155`.
**Rule:** data-governance §3 (no PII in `localStorage`). **Note:** access/refresh tokens are correctly cookie-only — this is about the cached profile.

### S2 — No Zod parsing of API responses (global)
None of the 14 `modules/*/services/index.ts` validate responses; they cast via `extractItem`/`extractCollection` helpers (e.g. `modules/users/services/index.ts:9-22`). `core/lib/dashboard.service.ts` and `core/lib/reference-data.ts` likewise return unparsed data.
The 3 existing `schema.ts` files (registration/survey/bynumber) are **RHF input** schemas, not response parsers.
**Rule:** Golden Rule 12 / security §4 — every adapter must `.strict().parse()` its response.

### S3 — PII / internal data written to `console`
- `modules/survey/services/index.ts:147` logs full **submission payload**; `:162` logs POST body; `:178`; `:181` logs raw `error.response?.data`.
- `modules/survey/hooks/useSurvey.ts:27` logs full submit `data`; `:36,:43,:46`.
- `modules/survey/components/SurveyForm.tsx:53`, `:187` (`console.log` validation errors).
- `modules/bynumber/services/index.ts:233` logs raw `error.response?.data`; plus `:59,74,89,113,127,176,185,221`.
- `modules/events/hooks/useEvents.ts:10` `console.log('RAW EVENTS DATA:', data)`.
**Rule:** security §9 + data-governance §6.

### S4 — Raw backend error surfaced to the DOM
- `app/(portal)/error.tsx` renders `error.message` (and logs full `error` at `:17`); hardcoded English strings.
- `shared/utils/apiError.ts:24-42` (`extractApiError`) returns the raw FastAPI `detail` to the UI — the inverse of the requirement.
**Rule:** security §9 (errors generic + translated; detail only to secure log). **Fix in Phase 1:** map backend codes → `common.errors.*`.

### S5 — Restricted-PII cached instead of zeroed
PII-bearing reads cache for 30–60s; none set `gcTime: 0`:
- `modules/registration/hooks/useRegistrations.ts:27` `staleTime: 30000`
- `modules/participation/hooks/useParticipations.ts:22` `staleTime: 30000`
- `modules/sports/hooks/useSportParticipants.ts:20` `staleTime: 30_000`
- `modules/dashboard/hooks/useDashboard.ts:31` `staleTime: 60000`
Registration `Enrollment` includes DOB, phone, gender, address, nationality, **national-ID URL, passport URL**, photo (`modules/registration/types/index.ts:36-85`).
**Rule:** data-governance §5 — Restricted-PII = `staleTime:0 + gcTime:0`.

### S6 — No cache wipe on logout
No `queryClient.clear()` in `core/auth/` (`logout` at `AuthContext.tsx:243-247` clears only `localStorage` + reducer). PII query cache survives sign-out.
**Rule:** data-governance §5.

### S7 — Data minimization: list over-fetches PII + PII in URL
`modules/registration/services/index.ts:31-50` `getRegistrations` returns full `Enrollment[]` (with PII) for the table — no lean/masked list DTO. `search` is sent as a **query-string param** (`{ params: { ...rest } }`), so name/ID searches land in the URL/history.
**Rule:** data-governance §2 (lean list DTO) + §3 (no PII in URLs; POST search body). No masking utility (`maskNationalId`, etc.) exists.

### S8 — UI permission gates + `super_admin` exclusion bug
No central capability hook; gates use role names directly. **Bare `role === UserRole.ADMIN` (excludes `super_admin`):**
- `modules/organizations/components/OrgList.tsx:17`
- `modules/registration/components/ParticipantList.tsx:17`
- `modules/reports/components/ReportList.tsx:57`
- `modules/cards/components/CardGrid.tsx:18`
- `modules/participation/components/ParticipationList.tsx:28`
- `modules/participation/components/ParticipationPage.tsx:18`

Correct (`hasRole([ADMIN, SUPER_ADMIN])` or both compared): EventList:28, EventDetailPage:47, DashboardPage:27, RegisterFormFields:78, BySportRecords:20, EventSportManager:25, EventSportOrgManager:22, CategoryList:21, SportList:19.
**Rules:** security §3 + Golden Rule 10 (every gate mirrored server-side; gate is UX only). Cross-ref project memory `superadmin-role-gate-bug`.

### S9 — No CSRF token / correlation ID / idempotency
`core/api/client.ts` attaches none. Cookie auth currently relies on `SameSite` alone.
**Rule:** security §6. **Phase 1, plan-only** (backend coordination).

**Clean:** no `dangerouslySetInnerHTML`; `NEXT_PUBLIC_` holds only public values (`env.ts` Zod-validates them); no untrusted-`href` interpolation found.

---

## 3. 🟠 ARCHITECTURE violations

### A1 — No Ports & Adapters layer (all modules)
I/O lives in `services/` calling `apiClient`; hooks import `../services`. Needs `ports/IXxxRepository.ts` + `adapters/xxxHttpAdapter.ts` (Zod-parsing) + `adapters/index.ts` per module. **Golden Rules 1–3.**

### A2 — Hook fragmentation (one-hook-per-file, Rule 5)
- **events = 15** files (useAddOrgToEventSport, useAddSportToEvent, useAllOrganizations, useAllSports, useCreateEvent, useDeleteEvent, useDeleteEventSportOrgLink, useEventDetail, useEventOrganizations, useEvents, useEventSportOrgs, useEventSports, useRemoveSportFromEvent, useUpdateEvent, useUpdateEventPhase) → `useEvents.ts` + `useMutateEvents.ts`.
- **sports = 10** → `useSports.ts` + `useMutateSports.ts`.
- users = 4, organizations = 4, participation = 3, registration = 3 → consolidate each.
- OK (≤2): bynumber, cards, survey, dashboard, reports.

### A3 — Logic/hooks in route `page.tsx` (should be Server Components)
9 pages are `'use client'` and call hooks: `app/(portal)/{users,register,registrations,organizations,events,sports,dashboard,bynumber,leaderregistration}/page.tsx` (e.g. `users/page.tsx` calls `useRequireRole`). **nextjs-and-i18n §1** — page renders module Page only; gating belongs in middleware/RSC + client convenience.

### A4 — No QueryKeys registry
`core/api/` has only `client.ts` + `unauthenticatedApiClient.ts`. **49 hardcoded `queryKey:` arrays** (events 15, sports 13, participation 7, organizations 4, users 4, registration 3, cards 2, dashboard 1). Needs `core/api/queryKeys.ts`.

### A5 — No Zustand stores for list UI state
No `store/` anywhere; filters/sort/pagination live in component `useState` (e.g. `EventList.tsx` 6× useState). Needs `store/<module>Filters.store.ts` per list module.

### A6 — Module service logic in `core/lib/`
`core/lib/dashboard.service.ts` → `modules/dashboard/api/`; `core/lib/reference-data.ts` → `core/api/referenceData.ts` or a reference module (migration table).

### A7 — `axios` imported into a hook
`modules/events/hooks/useAddOrgToEventSport.ts:5` imports `axios` (error inspection). Move axios-error handling behind the adapter. (Minor — not a data call.)

---

## 4. 🟡 HYGIENE violations

### H1 — `console.*` (~49 total)
Modules (besides S3): `modules/bynumber/components/ByNumberForm.tsx:89`, `modules/survey/components/SurveyContext.tsx:19`.
Core/shared/app: `core/lib/reference-data.ts:86,104,122,141,176`, `core/lib/dashboard.service.ts:45`, `core/lib/upload/cloudinary.ts:37,95`, `core/auth/context/AuthContext.tsx:34,167,195,202`, `shared/ui/QueryBoundary.tsx:29`, `app/(portal)/error.tsx:17`, `app/(portal)/events/[event_id]/{page.tsx:18,error.tsx:17}`, `app/(portal)/sports/[sport_id]/{page.tsx:17,error.tsx:17}`. **Golden Rule 20.**

### H2 — `any`
Only `modules/sports/components/CategoryForm.tsx:15-16` (`age_min`/`age_max: z.any().optional()`). Replace with `z.coerce.number().optional()`. Otherwise strict-clean.

### H3 — Hardcoded user-facing strings
`app/(portal)/error.tsx` ("Something went wrong", "Try again", "Go to dashboard") not translated. 11 components lack `useTranslations` — mostly thin wrappers (verify each for stray text): `cards/CardIframe`, `cards/CardViewModal`, `{events,sports,registration,users,organizations,bynumber}/*Page.tsx`, `survey/SurveyContext`, `auth/LoginPage`, `auth/ProtectedRoute`.

**Clean:** en/kh keys match exactly (0 diff); no hardcoded `toast('...')` literals (all use `t()`); 48/59 components already use i18n.

---

## 5. Prioritized remediation checklist

**Phase 1 — cross-cutting (before any module):**
1. [ ] (S1/S6) Auth: stop persisting `User` PII to `localStorage`; add `queryClient.clear()` on logout — **PLAN ONLY, needs `references/auth-migration.md` + backend review.**
2. [ ] (S9) `apiClient`: central CSRF header + correlation ID (+ idempotency key for record mutations).
3. [ ] (S8) Single `core/auth/usePermissions()` → `can(capability)`; migrate the 6 super_admin-excluding gates.
4. [ ] (S4) `shared/utils/apiError` → backend-code→i18n map; `error.tsx` renders generic translated message only.
5. [ ] (A4) `core/api/queryKeys.ts` registry.
6. [ ] Confirm/expand shared RHF wrappers (`shared/form/`).
7. [x] en/kh key parity — already matching (564/564).

**Phase 2 — per-module migration order** (security pass folded in for PII-heavy):
`users → organizations → sports → events → registration* → participation* → reports* → dashboard → survey/bynumber/cards`
(`*` = PII-heavy: do S2/S5/S7 + masking + audit hooks in the same migration.)

**Phase 3 — lock-in:** lint rules banning the above; mock-adapter swap into Vitest; CI gate (`tsc --noEmit` + lint + tests).

---

## 6. Notes
- **Workspace:** skill lives under `frontend/.claude/`; open the VS Code workspace at `frontend/` so `/skills` lists `national-frontend-architecture`.
- **`references/auth-migration.md`:** recommended before Phase 1. Good news — tokens are already httpOnly cookies, so the auth migration narrows to: (a) drop the `localStorage` PII cache, (b) `queryClient.clear()` on logout, (c) CSRF/correlation in `apiClient`.
