# Choschmous — Frontend Architecture & Design System Audit

**System:** National Sports Event Management System (MoEYS)
**Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, base-ui (+ shadcn listed), React Query, Zustand, react-hook-form + Zod, next-intl
**Scope reviewed:** 19 feature modules, 23 portal routes, shared design system, core (api/auth/config), i18n
**Date:** 2026-06-19

> **Verdict up front:** The *architecture* (module boundaries, auth, API layer, i18n) is genuinely strong — top ~10% of codebases at this stage. The *design-system/UI layer* is where the debt is: the right primitives exist but adoption is fragmented (3 competing table implementations, 2 filter patterns, a `Pagination` component nobody uses). The good news is the fix is **consolidation, not a rewrite.**

---

## PHASE 1 — Project Structure Analysis

### 1. Architecture Overview

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # login, unauthorized
│   ├── (portal)/               # authenticated app (23 routes)
│   │   ├── _components/PortalShell.tsx   # ProtectedRoute + Sidebar + TopBar + <main>
│   │   ├── <route>/page.tsx     # thin wrappers (9–25 LOC each)
│   │   └── <route>/loading.tsx  # per-route loading
│   ├── (public)/               # public marketing/landing
│   └── providers/              # Auth / Query / Intl
├── core/                       # cross-cutting infrastructure
│   ├── api/                    # axios client, queryKeys, endpoints, queryClient
│   ├── auth/                   # context, hooks, FEATURE_ACCESS, capabilities, token expiry
│   ├── config/                 # routes, eventTypes, constants
│   └── lib/                    # logger (port+impl), upload (cloudinary)
├── modules/                    # 19 feature modules (hexagonal)
│   └── <feature>/
│       ├── adapters/  api/  components/  hooks/
│       ├── ports/     schema/ (zod)  types/
│       ├── mappers/   store/  (some modules)
└── shared/                     # design system
    ├── ui/  ui/page/  form/  layout/  hooks/  utils/
```

**Patterns in play:**

- **Hexagonal / ports-and-adapters** per module: `ports/IXRepository.ts` (interface) → `adapters/xHttpAdapter.ts` (axios impl) → `mappers/` (DTO↔domain) → `hooks/` (React Query) → `components/`. 14 ports, 28 adapters. This is unusually disciplined.
- **Thin route pages**: every `page.tsx` is a `dynamic()` import of the module page + `useRequireRole(FEATURE_ACCESS.<feature>)`. Code-splitting is automatic and per-route.
- **State**: server state → React Query (43 hooks, centralized `queryKeys`); UI/filter state → Zustand (6 stores); session → React Context.
- **API**: single axios instance, `withCredentials`, **proactive token refresh** (consults a JWT-exp hint since the token is HttpOnly) **+ reactive 401 retry** with a shared single-flight refresh promise. Separate `unauthenticatedApiClient`.
- **Auth**: `FEATURE_ACCESS` is a single source of truth driving **both** nav visibility **and** route guards. Capabilities layer (`CROSS_ORG_ADMIN`, `REVEAL_PII`) abstracts role checks. No client-side PII caching; query cache wiped on logout/session-expiry.
- **Forms**: react-hook-form + Zod resolver; `shared/form` wrappers.
- **i18n**: next-intl, full English + Khmer (1,127 lines each) — present from day one.

### 2. Strengths

| Area | Why it's strong |
|---|---|
| **Module boundaries** | Hexagonal structure with ports/adapters/mappers — swappable data layer, testable domain, clear ownership. Rare at this maturity. |
| **Auth & session** | Proactive+reactive refresh, single-flight, fail-closed, PII never persisted, cache cleared on logout. Security-grade. |
| **Authorization model** | One `FEATURE_ACCESS` map feeds nav + guards; UX gates separated from server enforcement (correctly noted as server-authoritative). |
| **Design tokens** | HSL CSS-variable system: full primary scale (50–900), semantic colors with `-bg` variants, radius + font + weight scales. Solid foundation. |
| **i18n + a11y baseline** | Khmer/English from the start (critical for gov); base-ui primitives bring focus traps, keyboard nav; DataTable rows are keyboard-operable. |
| **Tooling hygiene** | `knip` clean, vitest + Playwright present, bundle analyzer wired, centralized error handling (`apiError.ts` + sonner). |

### 3. Weaknesses

1. **Three table implementations** — `ListPage` template (4 pages), `DataTable` used directly (10 places), raw `<table>` (9 places). No single source of truth for the most important enterprise widget.
2. **The template layer is built but under-adopted.** `ListPage` exists and is good, yet `EventList` and `ParticipationList` re-implement header + filter bar + table + pagination by hand (~150–300 LOC each).
3. **`Pagination` component is dead-on-arrival** — referenced **0 times directly**; ~8 components hand-roll the exact same "Showing X to Y of Z / Prev / Next" markup.
4. **Two filter patterns** — shared `Select` (12 files) vs raw `<select>` (8 files); no standardized filter toolbar.
5. **Status→variant logic duplicated** — `StatusBadge` has `STATUS_META`, `ParticipationList` redefines `STATUS_VARIANT`, `EventList` inlines `getStatus()`+badge color. Three encodings of "status color."
6. **Header proliferation** — `PageHeader`, `SectionHeader`, `DetailHeader`, `CardTitle`/`CardHeader`, `FormSection` overlap with no clear "when to use which."
7. **Zustand stores half-wired** — filter stores exist for 6 modules, but `ParticipationList` ignores its store and uses local `useState`. Inconsistent adoption defeats the abstraction.

### 4. Scalability Concerns

- **Filtering correctness bug at scale.** `ParticipationList` fetches one page (limit 10) from the server, then applies status/search filtering **to those 10 rows client-side** (the code comment admits the endpoint lacks params). Result: "filter by Rejected" only searches the current page — silently wrong as data grows.
- **`EventList` loads *all* events** (`useEvents()` with no pagination) then slices client-side. Fine at 20 events, broken at 2,000.
- **No URL/query-param state for filters.** Filters live in local `useState`, so they reset on refresh/navigation and can't be bookmarked or shared — a real problem for government review workflows ("send me the link to all flagged submissions").
- **Copy-paste list pages.** Each new list ≈ 150 LOC duplicated. 19 modules × divergence = a maintenance curve that worsens over the 3–5 year horizon.
- **No table virtualization** for large result sets.

### 5. Technical Debt (ranked)

| # | Debt | Risk |
|---|---|---|
| 1 | 3 table systems + dead `Pagination` | High — every list page diverges |
| 2 | Client-side filter/paginate on server-paginated data | High — **correctness**, not just style |
| 3 | Filters not in URL state | Medium-High — UX + shareability |
| 4 | Duplicated status-color maps | Medium — visual drift |
| 5 | `shadcn` in deps but `@base-ui/react` actually used | Medium — confusing toolchain signal for new devs |
| 6 | Bleeding-edge versions: **Next 16 preview**, lucide-react 1.8 | Medium — stability/supply-chain risk for a long-lived gov system |
| 7 | Header/section component overlap | Low-Medium |

---

## PHASE 2 — Design System Audit

### 1. Existing Inventory

| Category | Component(s) | Built on | Notes |
|---|---|---|---|
| **Buttons** | `Button` (CVA: 6 variants × 8 sizes, `loading`) | base-ui | ✅ Excellent, complete |
| **Inputs** | `Input`, `select.tsx`, `label`, `toggle-group`, `radio-card`, `selectable-grid`, `file-upload` | base-ui | ✅ Good coverage |
| **Forms** | `FormField`, `TextInputField`, `SelectField`, `FileUploadField`, `FormSection` | RHF+Zod | ⚠️ Barrel exports only 2 of them |
| **Tables** | `DataTable` (responsive, card-mode mobile, skeletons) | custom | ⚠️ No sort/select/sticky |
| **Modals/Dialogs** | `Modal`, `ConfirmDialog` (imperative `useConfirm`) | base-ui Dialog | ✅ Accessible |
| **Cards** | `Card` / `CardHeader` / `CardTitle` / `CardContent`, `StatCard` | custom | ✅ |
| **Badges** | `Badge` (9 variants), `StatusBadge`, `EventTypeBadge` | custom | ✅ but see status dup |
| **Headers** | `PageHeader`, `SectionHeader`, `DetailHeader` | custom | ⚠️ Overlapping |
| **Layouts** | `PageShell`, `TopBar`, `PortalShell`, `ContentPanel`, `ListPage` | custom | ✅ Good bones |
| **Navigation** | `Sidebar`, `SidebarNav`, `SidebarBrand`, `LanguageSwitcher`, breadcrumbs (in TopBar) | custom | ⚠️ Breadcrumbs hardcoded |
| **Empty states** | `PageEmptyState`, `PageNotFound` | custom | ✅ (6 usages) |
| **Loading states** | `Skeleton`, `SkeletonCard`, `PageLoadingState`, per-route `loading.tsx`, `QueryBoundary` | custom | ✅ Strong |
| **Errors** | `PageErrorState`, route `error.tsx` | custom | ✅ |
| **Steps** | `StepIndicator` | custom | ✅ (registration wizard) |
| **Pagination** | `Pagination` | custom | ❌ **Defined but unused** |

### 2. Missing Components

- **`DataTable` enterprise features**: column **sorting**, **row selection + bulk actions**, sticky header, column visibility/density toggle, server-driven filter binding, CSV/PDF export.
- **`FilterToolbar`** — a standard search + facet + active-chip + clear container.
- **`Tabs`** — none found; detail pages need them.
- **`Tooltip`, `Popover`, `DropdownMenu`** — row "⋯" action menus are done as inline button rows.
- **`Breadcrumbs`** as a real component (currently a hardcoded map in `TopBar` that can't show entity names).
- **`Chart` abstraction** — `GenderChart` is hand-rolled SVG (and references `hsl(var(--secondary))`, which isn't in the token scale — likely a silent fallback).
- **`Toast` UX** is wired (sonner) but no standard success/error helper surfaced to components.
- **`DescriptionList`/`Field` (read-only key→value)** — detail pages re-build this with raw `<table>`.

### 3. Duplicate Components

- Status→color mapping: `StatusBadge.STATUS_META` vs `ParticipationList.STATUS_VARIANT` vs inline in `EventList`.
- Pagination markup: re-implemented in ~8 components instead of `<Pagination>`.
- Headers: `PageHeader` / `SectionHeader` / `DetailHeader` / `CardTitle` overlap.
- Filter bars: every list builds its own `<div className="flex ... sm:flex-row">` search+select.

### 4. Inconsistent Implementations

- Tables: `ListPage` (Sports, Users, Orgs, Participants) vs raw `DataTable` (Events, Participation) vs raw `<table>` (9 detail/manager components).
- Selects: `Select` (base-ui) vs native `<select>` with duplicated Tailwind classes.
- Inputs: `Input` vs raw `<input>` (9 files).
- Pagination: 1-indexed (`EventList`) vs 0-indexed (`ParticipationList`).

### 5. Should Be Standardized (priority order)

1. **One table** → `<AppTable />` (Phase 4).
2. **One filter toolbar** → `<FilterToolbar />`.
3. **One status registry** → single `status → {variant,label}` map consumed by `StatusBadge`.
4. **One page template** → mandate `ListPage`/`DetailPage` for all list/detail screens.
5. **One pagination** → delete hand-rolled copies, use `<Pagination>` (server-driven).

---

## PHASE 3 — Page Inventory

| Page | Purpose | CRUD | Filters | Table | Forms | Charts | Key Actions |
|---|---|---|---|---|---|---|---|
| `/` (public) | Landing | — | — | — | — | — | Login CTA |
| `/login` | Authenticate | — | — | — | ✅ | — | Sign in |
| `/dashboard` | KPIs + overview | R | — | ✅ (TopOrgs, Recent) | — | ✅ Gender pie (SVG) | Role-based quick action |
| `/events` | Event mgmt | CRUD | Search + status | ✅ DataTable + mobile cards | ✅ Modal | — | Create/Edit/Delete/View |
| `/events/[eventId]` | Event detail | RU | — | raw `<table>` (sports/orgs) | ✅ | — | Manage sports, sport-orgs, phases, survey board |
| `/sports` | Sports mgmt | CRUD | (ListPage) | ✅ ListPage | ✅ | — | Create/Edit/Delete |
| `/sports/[sportId]` | Sport + categories | CRUD | — | raw `<table>` categories | ✅ | — | Manage categories/participants |
| `/organizations` | Org mgmt | CRUD | (ListPage) | ✅ ListPage | ✅ | — | Create/Edit/Delete |
| `/users` | User provisioning | CRUD | (ListPage) | ✅ ListPage | ✅ | — | Super-admin only |
| `/by-category` | Federation category survey | RU | raw `<select>` | raw `<table>` | ✅ | — | Submit/review by category |
| `/by-sport` | Org sport survey | RU | — | mixed | ✅ | — | Submit survey |
| `/by-number` | Participant-count survey | RU | — | raw `<table>` | ✅ | — | Enter counts, review step |
| `/open-survey` (+`/fields`) | Dynamic admin-defined survey | CRUD | raw `<select>` | — | ✅ builder | — | Field builder, fill survey |
| `/register` | Athlete registration **wizard** | C | — | — | ✅ 6-step | — | Personal→Event→Category→Team→Docs→Review |
| `/leader-registration` | Leader registration | C | — | — | ✅ | — | Submit |
| `/organizer-registration` | Organizer registration | C | raw `<select>`+`<input>` | — | ✅ | — | Submit |
| `/organizer-roles` | Organizer role mgmt | CRUD | — | raw `<table>` | ✅ | — | Assign roles |
| `/registrations` (+`[enrollId]`) | Registration records | RUD | (ListPage) | ✅ ListPage | ✅ edit | — | View/edit, **reveal PII** |
| `/participation` | Submissions review queue | RUD | Search + status (local) | ✅ DataTable | — | — | Approve/Reject/Flag, delete |
| `/sport-submissions` | Admin review (by-sport) | RU | raw `<select>` | raw `<table>` | — | — | Approve/Reject/Flag |
| `/category-submissions` | Admin review (by-category) | RU | raw `<select>` | raw `<table>` | — | — | Approve/Reject/Flag |
| `/cards` | ID/athlete cards | R | local page | grid | — | — | Generate/print cards |
| `/reports` | Reporting | CR | raw `<select>` (modal) | ✅ list | ✅ generate modal | — | Generate/download report |
| `/unauthorized` | 403 | — | — | — | — | — | — |

**Observation:** ~5 distinct "review/approve" surfaces (`participation`, `sport-submissions`, `category-submissions`, `by-number` review step, registrations) implement the same approve/reject/flag-with-reason workflow **independently**, with different table and filter code each time. This is the single biggest consolidation opportunity for a government review system.

---

## PHASE 4 — Data Table Audit

### Inventory of table-shaped UI

| Approach | Count | Examples |
|---|---|---|
| `ListPage` (template) | 4 | SportList, UserList, OrgList, ParticipantList |
| `DataTable` (direct) | 10 | EventList, ParticipationList, dashboard tables, … |
| Raw `<table>` | 9 | EventSportOrgManager, CategoryList, CategoryParticipantTable, ByNumberSportsTable, OrganizerRoleManager, CategorySubmissionDetail, ByNumberReviewStep, SubmissionDetail, SurveyStatusBoard |

### 1. Common Patterns

- Column = `{ header, accessor (key|fn), align, hideOnMobile, mobileLabel }`.
- Responsive: desktop `<table>` + mobile card list (in `DataTable`).
- `rowKey`, `onRowClick` (keyboard-accessible), skeleton rows, `isFetching` dim overlay.
- Empty state passed as `ReactNode`; loading via `isLoading`.

### 2. Missing Enterprise Features

- ❌ Column **sorting** (none anywhere)
- ❌ **Row selection + bulk actions** (critical for review queues: "approve 20 selected")
- ❌ **Server-driven** sort/filter/pagination contract (today it's client-side and buggy at scale)
- ❌ Sticky header / virtualization
- ❌ Column visibility & density
- ❌ **Export** (CSV/Excel/PDF) — expected in government reporting
- ❌ Per-row overflow menu (actions are inline button clusters)
- ❌ Saved views / URL-encoded state

### 3. Standardization Opportunities → recommend a single `<AppTable />`

```tsx
// shared/ui/table/AppTable.tsx — one table to rule all 23 lists
interface AppColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
  width?: string;
}

interface AppTableProps<T> {
  data: T[];
  columns: AppColumn<T>[];
  rowKey: (row: T) => string | number;

  // server-driven (replaces client-side slicing)
  pagination?: { page; pageSize; total; onChange };
  sorting?: { sortBy?: string; dir?: 'asc' | 'desc'; onChange };

  // enterprise
  selection?: { selected: Set; onChange; bulkActions?: ReactNode };
  rowActions?: (row: T) => ReactNode;     // → DropdownMenu
  onRowClick?: (row: T) => void;

  // state
  isLoading?; isFetching?; error?;
  emptyState?; toolbar?: ReactNode;        // ← FilterToolbar slots here
}
```

**Architecture decision:** Build `AppTable` as a thin façade. Given Next 16 + React 19, back it with **TanStack Table v8** (headless, already in your ecosystem via `@tanstack/react-query`) for sorting/selection/column models, while keeping your styling and the mobile-card renderer. `ListPage`/`DataTable` then become wrappers over `AppTable` so existing call sites migrate incrementally. **Crucially, the pagination/sort/filter contract must be server-driven** to fix the current correctness bug.

---

## PHASE 5 — Sidebar & Navigation Audit

### 1. Current Navigation Map

The sidebar (`Sidebar.tsx`) renders 4 flat sections, each item filtered by `FEATURE_ACCESS[feature].includes(role)`:

```
§1 Overview      Dashboard
§2 Management    Events · Sports · Organizations · Federations(→by-category) · Users
§3 Registration  By-Sport · By-Number · Open Survey · Athlete Reg · Leader Reg
§4 Records       Organizer Reg · Organizer Roles · Registrations · Submissions(→participation)
                 · Sport Submissions · Category Submissions · Reports
```

Plus a collapsible rail (persisted to `localStorage`), a mobile drawer, and a `TopBar` with breadcrumbs (hardcoded `BREADCRUMB_MAP`) + user menu + language switcher.

### 2. UX Issues

- **Section labels aren't rendered** — sections are visually separated but unlabeled; a user sees ~17 flat icons with no group headings.
- **Naming mismatches confuse users**: "Federations" routes to `/by-category`; "Submissions" → `/participation`; "By-Sport/By-Number/By-Category" are opaque internal terms, not user language.
- **Review queues are scattered** across §3 and §4 (`participation`, `sport-submissions`, `category-submissions`, `by-number`) — no unified "Review" hub.
- **Breadcrumbs can't show entity names** — `/events/123` shows "Events", not the event title (hardcoded map, no dynamic segment resolution).
- **No global search / command palette** — at ~17 destinations + thousands of records, this becomes a daily friction point for gov staff.
- **§4 is overloaded** (7 items mixing data-entry and review).

### 3. Better Grouping Strategy (role-aware, task-oriented)

```
OVERVIEW
  └ Dashboard

EVENTS & SETUP            (admin)
  └ Events · Sports · Categories

REGISTRATION             (organization)
  └ Register Athlete · Register Leader · Register Organizer
  └ My Registrations · ID Cards

SURVEYS                  (org / federation)
  └ By-Sport · By-Number · By-Category · Open Survey   ← rename to plain-language

REVIEW & APPROVALS       (admin)   ← consolidate the 5 scattered queues
  └ Submissions · Sport Submissions · Category Submissions

REPORTING
  └ Reports

ADMINISTRATION           (super-admin)
  └ Users · Organizations · Organizer Roles
```

Add: **rendered section labels**, a **"Review" badge count** (pending items), **dynamic breadcrumbs** (resolve entity name on detail routes), and a **⌘K command palette**.

---

## PHASE 6 — Government System UX Review

| Capability | Supported? | Gap |
|---|---|---|
| **Event management** | ✅ Full CRUD, phases, sport/org config | Detail page uses raw tables; no phase timeline viz |
| **Registrations** | ✅ Strong 6-step wizard, team/individual modes, docs, PII reveal | No bulk import; filters not in URL |
| **Reviews** | ⚠️ Works but **5 divergent implementations** | No unified queue, no bulk approve, no SLA/age indicators |
| **Approvals** | ⚠️ Approve/Reject/Flag with reason | No multi-step approval chain, no delegation, no "my queue" |
| **Reporting** | ⚠️ Generate + download | No scheduled/saved reports, limited charts, no export from tables |
| **Audit history** | ❌ **Largely missing** | Backend audits PII reveals, but **no UI** shows who-did-what-when on entities. Critical gap for government. |
| **User management** | ✅ Super-admin CRUD | No bulk ops, no activity log, no password-reset/invite flow visible |

### Missing Enterprise UX Patterns

1. **Audit trail / activity timeline** on every entity (events, registrations, submissions) — non-negotiable for accountability in gov systems.
2. **Unified review workbench** — one queue, status facets, bulk actions, reason templates, keyboard triage.
3. **URL-addressable filtered views** — "share me the link to all flagged volleyball submissions."
4. **Bulk operations + import/export** — gov volume demands CSV import and table export.
5. **Notifications / pending-work indicators** — counts on nav, optional digest.
6. **Optimistic concurrency / "edited since you loaded"** warnings on shared records.
7. **Print/official-document mode** — `/cards` hints at it; generalize to report/registration printables.
8. **Empty-but-actionable + permission-aware affordances** (already partly done via `usePermissions` — extend consistently).

---

## PHASE 7 — Design System Roadmap (framework unchanged: Next/TS/Tailwind/Shadcn-base-ui)

### 1. Design System v1

- **Tokenize fully**: keep the HSL variable system; add the missing `--secondary` referenced by `GenderChart`; define a **chart palette** token set; document semantic usage (success/warning/danger/info/muted). One `theme.md`.
- **Primitive contract**: every interactive primitive on `@base-ui/react` + CVA. **Resolve the shadcn-vs-base-ui ambiguity** (pick base-ui, drop or document the `shadcn` dep).
- **Component API conventions**: `className` last + `cn()`, `data-slot` attributes, `variant`/`size` via CVA, controlled+imperative where relevant.

### 2. Layout Standard

`AppShell` (= current PortalShell) → `Page` template with slots:

```
<Page header={<PageHeader/>} toolbar={<FilterToolbar/>} >
  <AppTable/> | <DetailLayout/> | <FormLayout/>
</Page>
```

Mandate `PageShell` width tokens (`wide`/`default`/`narrow`), consistent `space-y-6`.

### 3. Table Standard

`<AppTable/>` (Phase 4) backed by TanStack headless; **server-driven** sort/filter/page contract; selection + bulk actions + row overflow menu + export. `ListPage` and `DataTable` become wrappers; raw `<table>` reserved for static key→value (replace with `<DescriptionList/>`).

### 4. Filter Toolbar Standard

`<FilterToolbar/>`: search box + facet selects (base-ui `Select`) + active-filter chips + clear-all, **bound to URL search params** (and optionally Zustand for cross-page memory). Kills the 8 raw `<select>` bars.

### 5. Status Badge Standard

Single registry consumed everywhere:

```ts
// shared/ui/status/registry.ts
export const STATUS = {
  draft: { variant: 'muted' }, submitted: { variant: 'info' },
  approved: { variant: 'success' }, rejected: { variant: 'error' },
  flagged: { variant: 'warning' }, revision_requested: { variant: 'warning' },
} satisfies Record<EntityStatus, { variant: BadgeVariant }>;
```

`StatusBadge` reads it; delete `ParticipationList.STATUS_VARIANT` and `EventList` inline logic.

### 6. Page Template Standard

Two canonical templates: **`ListPage`** (header + toolbar + AppTable + pagination + empty/error) and **`DetailPage`** (DetailHeader + Tabs + DescriptionList + AuditTimeline). Every route uses one or the other. Consolidate `PageHeader`/`SectionHeader`/`DetailHeader` into a documented set with clear roles.

### 7. Dashboard Standard

`StatsGrid` (KPI cards) + a real **`<Chart/>`** abstraction (wrap a lib or formalize the SVG approach with chart tokens) + standardized `Panel` (header + body + "view all" link). Role-aware widget composition (already started in `DashboardPage`).

---

## PHASE 8 — Implementation Priority (ROI-ranked)

Legend — Impact/Difficulty: ●●● high · ●● med · ● low

### Week 1 — Foundations + correctness (highest ROI)

| Priority | Task | Impact | Difficulty | Affected Pages |
|---|---|---|---|---|
| P0 | **Status registry** — single source, refactor StatusBadge consumers | ●●● | ● | participation, events, all review pages |
| P0 | **Fix server-side filter/pagination contract** in adapters (status/search/page params); stop client-side slicing | ●●● | ●● | participation, events, all review queues |
| P0 | **Adopt `<Pagination>`** everywhere; delete hand-rolled copies | ●● | ● | ~8 list pages |
| P1 | **`<FilterToolbar>`** standard + URL-param state | ●●● | ●● | events, participation, 6 review/list pages |

### Week 2 — The table

| Priority | Task | Impact | Difficulty | Affected Pages |
|---|---|---|---|---|
| P0 | **Build `<AppTable>`** (TanStack-backed): sorting, server pagination, empty/error/loading | ●●● | ●●● | all 23 list/table screens |
| P1 | Make `ListPage`/`DataTable` thin wrappers over `AppTable` (no call-site churn) | ●●● | ●● | 14 existing usages |
| P2 | Replace static raw `<table>` with `<DescriptionList>` | ●● | ● | 9 detail/manager components |

### Week 3 — Review workbench + nav

| Priority | Task | Impact | Difficulty | Affected Pages |
|---|---|---|---|---|
| P0 | **Unified Review workbench**: one queue UI w/ facets + **bulk approve/reject/flag** + reason templates | ●●● | ●●● | participation, sport-submissions, category-submissions, by-number |
| P1 | **Nav restructure**: rendered section labels, task-oriented groups, pending-count badges | ●● | ●● | sidebar (global) |
| P1 | **Dynamic breadcrumbs** (resolve entity names on detail routes) | ●● | ● | events/[id], sports/[id], registrations/[id] |

### Week 4 — Government enterprise patterns

| Priority | Task | Impact | Difficulty | Affected Pages |
|---|---|---|---|---|
| P0 | **Audit/activity timeline** component + surface backend audit events on entities | ●●● | ●● | events, registrations, submissions, users |
| P1 | **Table export (CSV/PDF)** + row selection bulk export | ●● | ●● | all lists, reports |
| P2 | **⌘K command palette** + global search | ●● | ●● | global |
| P2 | `DetailPage` template + Tabs primitive; migrate event/sport detail | ●● | ●● | events/[id], sports/[id] |
| P3 | **De-risk versions**: pin Next off-preview before production; review lucide/base-ui majors | ●● | ● | build/infra |

**Sequencing rationale:** Week 1 fixes a *correctness* bug and lands the cheap consolidations that everything else builds on. Week 2's `AppTable` is the keystone — every later item (review workbench, export, selection) plugs into it. Weeks 3–4 deliver the government-specific value (unified approvals, audit history) that the current UI lacks.

---

## Bottom line

This is an **A-grade application architecture** sitting under a **C+ design-system layer**. Don't touch the modules, ports/adapters, auth, or i18n — they're built to last. Invest the next 4 weeks in **consolidation**: one table, one filter toolbar, one status registry, one page template, plus the two government must-haves (**unified review workbench** + **audit timeline**) and the one correctness fix (**server-side filtering**). That converts ~30 divergent UI implementations into ~5 standards — which is exactly what makes a system maintainable for 3–5 years.
