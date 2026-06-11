# Technical Audit Report — Dead Code, Mock Data & Data-Source Consistency

**Date:** 2026-06-10
**Scope:** `frontend/` (Next.js 16 / React 19 app, 365 TS/TSX files) with a targeted
backend cross-check of the dashboard stats pipeline.
**Method:** static analysis with `knip@5`, `tsc --noEmit`, `eslint`, plus manual
import-graph verification of every candidate before removal.

**Validation after changes:** `tsc --noEmit` ✓ (0 errors) · `eslint` ✓ (0 errors,
1 pre-existing warning) · `vitest` ✓ (11/11) · `next build` ✓ (22/22 routes).

---

## 1. Headline finding — the only fabricated metric in the UI

**`src/modules/dashboard/components/StatsGrid.tsx`** rendered a hardcoded
`+12% — "Compared to last month"` trend badge on the first KPI card:

```tsx
trend={ idx === 0 ? { value: 12, isUp: true, subtitle: "Compared to last month" } : undefined }
```

- **Why it's wrong:** the dashboard payload (`dashboard.schema.ts`) has **no `trend`
  field** and the backend `dashboard_service.py` never computes one. The value `12`
  was invented in the component — a static placeholder shown to every user, on every
  org, every month. It is the single piece of fabricated data rendered in the product.
- **Fix:** removed the fabricated `trend` prop. The generic `trend` capability on the
  reusable `StatCard` component is retained for when the backend actually supplies
  period-over-period deltas.

Everything else on the dashboard (`StatsGrid`, `GenderChart`, `TopOrgsTable`,
`RecentEnrollments`) is correctly driven by live, backend-computed data via
`useDashboard()` → `dashboardHttpAdapter` → `/api/.../dashboard`.

---

## 2. Mock / static / placeholder data audit (items 9–10)

| Searched for | Result |
|---|---|
| `mockData` / `sampleData` / `dummyData` / fake API responses | **None found** |
| Hardcoded dashboard statistics / static counters | **1** — the `+12%` trend (fixed above) |
| Placeholder metrics in cards/charts/tables | None beyond the trend |
| Local mock objects standing in for API data | None |

**Static arrays that are legitimate (kept):** these are domain catalogs / enums, not
data masquerading as API results, and are correctly *not* fetched:
- `REPORT_CARDS` (`reports/ReportList.tsx`) — the report catalog (titles + "coming soon"
  flags). The report **inputs** (events, organizations) come live from `useCascadingData()`.
- `GENDER_OPTIONS`, `ID_DOCUMENT_OPTIONS`, `ROLE_OPTIONS`, `LEADER_ROLE_OPTIONS`
  (`core/config/constants.ts`) — fixed form enums.
- `EVENT_TYPES` — the 4 MoEYS event categories (see §4, was duplicated).

**Backend cross-check:** `dashboard_service.py` computes all stats from real DB
aggregates; the only `placeholder` strings in the backend are the JWT-secret startup
guard (a security check, not data). No mock data in the backend.

---

## 3. Dead code removed (items 9, full-codebase)

### 3a. Unused files deleted (21 files)

Verified with `knip` **and** a manual inbound-import grep (0 references each):

| File | Why it's dead |
|---|---|
| `modules/survey/components/BySportRecords.tsx` | Orphaned component — the `/bysport` route renders `SurveyForm`, never this view |
| `modules/survey/components/SurveyContext.tsx` | `SurveyProvider`/`useSurveyContext` never imported; form uses react-hook-form |
| `modules/bynumber/hooks/useByNumberMutation.ts` | Dead parallel submit path; the live path is `useByNumberForm` (inline mutation) |
| `modules/events/mappers/events.mapper.ts` | `formDataToCreateDto`/`UpdateDto` never imported (mapping done inline) |
| `modules/events/store/eventsFilters.store.ts` | Unwired zustand filter store (see §5) |
| `modules/participation/store/participationFilters.store.ts` | Unwired zustand filter store |
| `modules/registration/store/registrationFilters.store.ts` | Unwired zustand filter store |
| `modules/sports/store/sportsFilters.store.ts` | Unwired zustand filter store |
| `modules/users/store/usersFilters.store.ts` | Unwired zustand filter store |
| `modules/cards/hooks/useCard.ts` | Singular `useCard` unused; cards use `useCards` (plural) |
| `core/lib/upload/cloudinary.ts` | Superseded by `fileStorage.ts` (the active upload path) |
| `env.ts` | Never imported anywhere |
| `app/providers/index.ts` | Unused barrel (0 directory-imports) |
| `core/config/index.ts` | Unused barrel |
| `shared/hooks/index.ts` | Unused barrel |
| `shared/utils/index.ts` | Unused barrel (consumers import `@/shared/utils/cn` directly) |
| `design_handoff_athlete_registration/reference/{app,data,steps,ui}.jsx`, `styles.css`, `index.html` | Design-handoff reference artifacts sitting inside `src/`, not imported, and **duplicated** in `docs/design_handoff_athlete_registration/reference/` |

Removed the now-empty directories as well.

### 3b. Dead exports removed from live files

| Symbol | File | Note |
|---|---|---|
| `calculateAge()` | `core/api/referenceData.ts` | Zero usages |
| `useUserDetail()` | `modules/users/hooks/useUsers.ts` | No `users/[id]` detail route exists |
| `useOrganizationDetail()` | `modules/organizations/hooks/useOrganizations.ts` | No `organizations/[id]` detail route exists |
| `useEventOrganizations()` | `modules/events/hooks/useEvents.ts` | Never consumed |
| `CLOUDINARY_FOLDERS` | `core/config/constants.ts` | Orphaned with `cloudinary.ts` |

Also tightened `referenceData.ts`: `fetchEvents` / `getUniqueEventTypes` were `export`ed
but only used internally by `loadCascadingData` → reduced to module-private.

### 3c. Unused imports cleaned (9 lint warnings → 0)

Stripped dead named imports in `RegisterFormNavButtons.tsx`, `RegisterReviewStep.tsx`,
`SurveyFormFields.tsx`, `SurveyFormSportsStep.tsx`, `SurveySuccess.tsx`
(unused `lucide-react` icons + unused `cn`/`Badge`).

---

## 4. Duplicate business logic refactored (item 9)

`EVENT_TYPES` and `EVENT_TYPE_ICONS` — the four MoEYS event categories with their
official Khmer labels — were **byte-for-byte duplicated** in
`survey/components/SurveyForm.tsx` and `bynumber/components/ByNumberForm.tsx`.

- **Risk:** the two wizards could silently drift (a label fixed in one, not the other).
- **Fix:** extracted to a single source of truth, `src/core/config/eventTypes.ts`, and
  imported it in both wizards.

---

## 5. Inconsistent data-fetching patterns (item 11)

**Finding — one real inconsistency, now resolved:** the architecture had scaffolded a
zustand `*Filters.store.ts` for five list modules (events, participation, registration,
sports, users), but **none were wired up**. The list pages actually hold filter state in
local `useState` and pass it as params into the shared
`useQuery` + repository/adapter pattern. The dead stores were a half-finished alternative
approach that would have confused future contributors. Removing them (§3a) leaves **one
consistent pattern** across every list module.

**Otherwise data fetching is already consistent and well-architected:**
- Every module uses the same **ports → adapter → react-query hook** layering.
- Shared reference data flows through one path (`loadCascadingData` → `useCascadingData`),
  reused by both registration and reports.
- **Dashboard vs. reports do not double-compute:** dashboard stats are backend
  aggregates; reports are backend-generated `.xlsx`. No client-side stat math that could
  diverge between the two.

---

## 6. Files modified — summary

**Created (1):** `src/core/config/eventTypes.ts`
**Deleted (21 files + design-handoff dir):** see §3a
**Edited (13):** `StatsGrid.tsx`, `SurveyForm.tsx`, `ByNumberForm.tsx`,
`referenceData.ts`, `constants.ts`, `useUsers.ts`, `useOrganizations.ts`, `useEvents.ts`,
`cards/hooks/index.ts`, `RegisterFormNavButtons.tsx`, `RegisterReviewStep.tsx`,
`SurveyFormFields.tsx`, `SurveyFormSportsStep.tsx`, `SurveySuccess.tsx`

---

## 7. Performance & data-sync improvements

- **Bundle:** ~21 source files + a duplicated design-reference set removed from the
  module graph; dead `lucide-react` icon imports pruned. Build remains green at 22/22 routes.
- **Correctness/trust:** users no longer see an invented `+12%` growth figure — every
  number on the dashboard is now traceable to a backend query.
- **Maintainability:** event-type catalog deduped to one file; list-filter pattern is now
  singular and consistent.

---

## 8. Remaining technical debt & recommendations

1. **Redundant barrel layering (~80 knip "unused exports").** Most are *not* dead code —
   components are exported through both a `components/index.ts` sub-barrel **and** the
   module's top-level `index.ts`, and consumers import via the top barrel. The symbols are
   alive; the intermediate re-export is redundant. **Recommendation:** flatten to a single
   barrel per module, or adopt knip's `--include exports` selectively. Low priority, not
   urgent — deferred here because touching public module surfaces is higher-risk than the
   wins justify in one pass.
2. **`authService` (`core/auth/services/index.ts`)** is flagged as an unused export (named
   + default). It is auth-critical and was **not** touched in this pass; confirm whether
   it's a legacy duplicate of the active login service before removing.
3. **i18n gaps in dashboard widgets:** `GenderChart` / `TopOrgsTable` have a few
   hardcoded English subtitles ("total members", "participants", "By participant count")
   while the rest of the app uses `next-intl`. Not mock data — a translation-coverage gap.
4. **`<img>` in `shared/ui/file-upload.tsx`** → consider `next/image` for the upload
   preview (the one remaining eslint warning; left as-is to avoid touching upload behavior).
5. **Unused dependencies** reported by knip: `shadcn`, `@testing-library/react`,
   and unlisted `postcss`. Verify and reconcile `package.json` before the next release.
6. **CI guard:** add `knip` (and keep `tsc`/`eslint`) to CI so dead files and fabricated
   placeholders can't re-accumulate.
