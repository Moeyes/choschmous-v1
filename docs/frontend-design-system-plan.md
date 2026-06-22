# Enterprise Design-System Implementation Plan

**Owner:** Frontend Lead · **Status:** Proposed · **Date:** 2026-06-19
**Stack (frozen):** Next.js 16, React 19, TypeScript, Tailwind 4, `@base-ui/react`, React Query, next-intl (en/kh)

> This plan builds on the architecture audit (`docs/frontend-audit.md`). It does **not** re-audit, does **not** touch the backend, and introduces **no new frameworks**. Where the audit recommended a "TanStack-backed table," we deliberately evolve the existing hand-rolled `DataTable` instead of adding `@tanstack/react-table` — see [Decision Log](#decision-log).

---

## 0. North Star

Today the app has a strong hexagonal architecture but a **fragmented UI layer**: 3 table implementations, hand-rolled pagination/filters, status→color logic duplicated 3×, and a client-side filter/paginate correctness bug. The result _looks_ inconsistent even though the data layer is solid.

The goal is a **single enterprise-grade shell** where every list page, detail page, filter, stat strip, and table is the same primitive. We achieve this by **consolidation, not rewrite**: a small set of composable templates (`AppPage`, `DetailPage`) + workhorse primitives (`AppTable`, `FilterToolbar`, `PageStats`) + a typography layer + a tightened sidebar.

### Target layering

```
PortalShell  (Sidebar + TopBar + main)              ← shell, already exists
  └─ AppPage / DetailPage      (templates)           ← NEW (item 1, 7)
       ├─ PageStats            (KPI strip)           ← NEW wrapper over StatCard (item 3)
       ├─ FilterToolbar        (URL-synced filters)  ← NEW (item 2)
       └─ AppTable             (sort/select/paginate)← EVOLVE DataTable (item 4)
Typography   (Heading/Text + @layer classes)         ← NEW (item 6)
Sidebar      (data-driven, ⌘K, footer)               ← REDESIGN (item 5)
```

### Design tokens (already defined, reuse — do not re-invent)
`globals.css` already exposes the full system: `--primary-50..900`, surface (`--card`, `--sidebar`, `--border`), semantic (`--success/warning/danger/info` + `-bg`/`-foreground`), typography (`--heading`, `--body`, `--muted-text`), and `--radius-*`. **Every component below consumes these tokens via Tailwind classes (`text-heading`, `bg-card`, `border-border`, …). No new colors.**

---

## Item Index

| # | Component | Type | New / Evolve | Effort |
|---|-----------|------|--------------|--------|
| 1 | `AppPage` | Template | New (absorbs `ListPage`) | 2.0 d |
| 2 | `FilterToolbar` | Primitive | New | 3.0 d |
| 3 | `PageStats` | Primitive | New (wraps `StatCard`) | 1.0 d |
| 4 | `AppTable` | Primitive | Evolve `DataTable` | 3.5 d |
| 5 | Sidebar redesign | Shell | Evolve `Sidebar` | 2.5 d |
| 6 | Typography | Foundation | New (`Text`/`Heading` + CSS layer) | 1.5 d |
| 7 | `DetailPage` | Template | New (absorbs `DetailHeader`) | 2.0 d |
| — | Migration of pages | — | — | 4.0 d |
| | | | **Total** | **~19.5 dev-days** |

Proposed folder layout for all new shared UI (extends the existing `src/shared/ui/` convention; keeps the established `page/` folder):

```
src/shared/ui/
  ├─ page/              # templates live here (existing)
  │   ├─ AppPage.tsx           NEW (item 1)
  │   ├─ DetailPage.tsx        NEW (item 7)
  │   ├─ ListPage.tsx          DEPRECATED shim → AppPage
  │   ├─ DetailHeader.tsx      kept, used by DetailPage
  │   └─ index.ts
  ├─ table/             # NEW (item 4)
  │   ├─ AppTable.tsx
  │   ├─ columns.ts            # ColumnDef<T> + helpers
  │   ├─ TableToolbar.tsx
  │   ├─ useTableSelection.ts
  │   └─ index.ts
  ├─ filters/           # NEW (item 2)
  │   ├─ FilterToolbar.tsx
  │   ├─ fields/ (SearchField, SelectFilter, DateRangeFilter, SegmentedFilter)
  │   ├─ useFilterState.ts     # URL <-> typed state, no new dep
  │   └─ index.ts
  ├─ stats/             # NEW (item 3)
  │   ├─ PageStats.tsx
  │   ├─ StatCard.tsx          # moved from ui/ root
  │   └─ index.ts
  ├─ typography/        # NEW (item 6)
  │   ├─ Text.tsx
  │   ├─ Heading.tsx
  │   └─ index.ts
  └─ ... (existing Badge, Button, StatusBadge, etc.)
```

---

## 1. AppPage

The single template for every **index / list / collection** page. It owns the vertical rhythm, header, optional stats strip, optional filter toolbar, and the loading/error/empty lifecycle — so no page hand-rolls `<PageShell><div className="space-y-6">…` again. `ListPage` becomes a thin shim over it.

### Component architecture
- `AppPage` composes existing `PageShell` (width) + `PageHeader` (title block) + slots.
- Three named slots between header and content: `stats` (renders `PageStats`), `toolbar` (renders `FilterToolbar`), and `children` (the table / grid).
- Centralizes status rendering: it decides between `PageLoadingState`, `PageErrorState`, `PageEmptyState`, and content — the same states already in `shared/ui/page/`. This removes per-page `if (error) … if (isLoading) …` branching.
- Pure composition, no data fetching. Stays a client component (header/toolbar are interactive).

### Props interface

```ts
// src/shared/ui/page/AppPage.tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface AppPageProps {
  /** Header */
  title: string;
  description?: string;
  icon?: LucideIcon;
  breadcrumbs?: Crumb[];            // future: feeds TopBar dynamic crumbs (item 5)
  primaryAction?: ReactNode;        // e.g. <Button>New event</Button>
  secondaryActions?: ReactNode;     // export, bulk, etc.

  /** Slots */
  stats?: ReactNode;                // <PageStats .../>
  toolbar?: ReactNode;              // <FilterToolbar .../>
  children: ReactNode;              // <AppTable .../> or grid

  /** Lifecycle — AppPage renders the right state automatically */
  isLoading?: boolean;              // first load → skeleton
  isFetching?: boolean;             // background refetch → subtle dim (passed to table)
  error?: Error | null;
  isEmpty?: boolean;                // resolved-but-no-rows → empty state
  emptyState?: ReactNode;           // override default empty UI

  /** Layout */
  maxWidth?: "default" | "wide" | "narrow" | "full"; // → PageShell size
  className?: string;
}

export interface Crumb { label: string; href?: string }
```

### Design guidelines
- Outer rhythm: `space-y-6` (matches current `PageShell`). Header → stats → toolbar → content.
- Header uses the **existing** `PageHeader` (icon chip `bg-primary-50 text-primary`, `text-xl/2xl font-bold text-heading`). Do not restyle.
- Error/empty are **page-level** states (full content area), never inline in the table, to keep one visual language.
- `isFetching` never blanks the page — it dims the table (`opacity-60`) via `AppTable`, preserving context.

### Example code

```tsx
"use client";
import { PageShell } from "@/shared/layout";
import { PageHeader, PageErrorState, PageEmptyState } from "@/shared/ui/page";

export function AppPage({
  title, description, icon, primaryAction, secondaryActions,
  stats, toolbar, children,
  isLoading, error, isEmpty, emptyState,
  maxWidth = "wide", className,
}: AppPageProps) {
  const action = (primaryAction || secondaryActions) && (
    <>{secondaryActions}{primaryAction}</>
  );

  return (
    <PageShell size={maxWidth} contentClassName={className}>
      <PageHeader title={title} description={description} icon={icon} action={action} />
      {stats}
      {toolbar}
      {error ? (
        <PageErrorState title={title} description={error.message} />
      ) : isEmpty && !isLoading ? (
        emptyState ?? <PageEmptyState title="No results" />
      ) : (
        children /* AppTable handles its own isLoading skeleton */
      )}
    </PageShell>
  );
}
```

Usage (an index page after migration):

```tsx
<AppPage
  title={t("events.title")} icon={Calendar}
  primaryAction={<Button onClick={openCreate}>{t("events.new")}</Button>}
  stats={<PageStats items={eventStats} isLoading={isLoading} />}
  toolbar={<FilterToolbar config={EVENT_FILTERS} />}
  isLoading={isLoading} error={error} isEmpty={rows.length === 0}
>
  <AppTable columns={cols} data={rows} rowKey={(e) => e.id}
            sort={sort} onSortChange={setSort}
            pagination={pagination} isFetching={isFetching} />
</AppPage>
```

### Migration strategy
1. Build `AppPage`. Keep `ListPage` but **reimplement it as a shim** that maps its old props onto `AppPage` + `AppTable` (zero breakage for the 4 current `ListPage` consumers).
2. New/edited pages adopt `AppPage` directly.
3. Convert the 10 `DataTable`-direct pages to `AppPage` + `AppTable` opportunistically (one PR per module).

### Affected pages
- **Direct (shim, no change needed):** `OrgList`, `ParticipantList`, `SportList`, `UserList` (current `ListPage` users).
- **Convert to AppPage:** all 10 `DataTable`-direct list pages — `EventList`, `ParticipationList`, `ParticipationOrgList`, `SportSubmissionList`, `CategorySubmissionList`, `CategorySportList`, `RecentEnrollments`, etc.

### Estimated implementation time
**2.0 dev-days** (AppPage + ListPage shim + states wiring + tests).

---

## 2. FilterToolbar

A declarative, **URL-synced** filter bar. This is the component that fixes the audit's **correctness bug** (`ParticipationList`/`EventList` filter & paginate client-side over server-paginated data, so a status filter only searches the loaded page). Filters become URL params → drive the server query → React Query refetches the correct page.

### Component architecture
- **Config-driven:** consumer passes an array of field descriptors; `FilterToolbar` renders search + selects + date-range + segmented toggles, all styled identically (replacing the 8 raw `<select>` and mixed `Select` usages).
- **State lives in the URL** via a `useFilterState` hook built on Next's `useSearchParams` / `usePathname` / `useRouter().replace` (**no new dependency** like `nuqs`). URL is the single source of truth → shareable/bookmarkable filtered views, back-button works, and it feeds React Query keys directly.
- Debounced search (300 ms) writes to URL; selects write immediately. Reset clears all keys.
- Emits a typed object; the page passes it straight into its list hook.

### Props interface

```ts
// src/shared/ui/filters/FilterToolbar.tsx
export type FilterFieldType = "search" | "select" | "daterange" | "segmented";

export interface FilterField {
  key: string;                       // URL param + query key
  type: FilterFieldType;
  label?: string;                    // i18n string
  placeholder?: string;
  options?: { value: string; label: string }[]; // select / segmented
  width?: "sm" | "md" | "grow";
}

export interface FilterToolbarProps {
  config: FilterField[];
  /** When true (default) state is read from / written to the URL. */
  syncToUrl?: boolean;
  /** Controlled mode (syncToUrl=false): supply value + onChange. */
  value?: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
  /** Extra right-aligned controls (export button, view toggle). */
  actions?: ReactNode;
  className?: string;
}

// Hook the page consumes to read current filters for its query:
export function useFilterState(config: FilterField[]): {
  filters: Record<string, string>;
  setFilter: (key: string, value: string | null) => void;
  reset: () => void;
};
```

### Design guidelines
- Container: `flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3`. Sits between stats and table, full width.
- Search field: leading `Search` icon, `h-9`, `rounded-lg border-border`. Selects reuse the shared `Select` (base-ui) for consistency — **never** raw `<select>`.
- Active-filter affordance: a "Clear" ghost button appears only when ≥1 filter is set; show count as a small `Badge`.
- Mobile: collapses into a single "Filters" button that opens a `Modal`/sheet with the same fields.

### Example code

```tsx
"use client";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export function useFilterState(config: FilterField[]) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of config) out[f.key] = params.get(f.key) ?? "";
    return out;
  }, [config, params]);

  const setFilter = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page"); // any filter change resets pagination
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);
  return { filters, setFilter, reset };
}
```

```tsx
// page side — filters flow straight into the server query key
const { filters } = useFilterState(EVENT_FILTERS);
const page = Number(useSearchParams().get("page") ?? 1);
const { data, isFetching } = useEvents({ ...filters, page }); // React Query key includes filters
```

### Migration strategy
1. Ship `FilterToolbar` + `useFilterState`.
2. **Backend dependency (flagged, not our scope):** list endpoints must accept `status`/`search`/sort params. Until then, `FilterToolbar` is wired but the page can fall back to client filtering of the *full* dataset where small. Track as a backend ticket — this is the real fix for the correctness bug.
3. Replace raw `<select>` filter blocks page-by-page; delete local `useState` filter state in favor of `useFilterState`.

### Affected pages
The 8 raw-`<select>` filterers: `CategorySportList`, `CategorySubmissionList`, `ParticipationList`, `ParticipationOrgList`, `ParticipantList`, `SportSubmissionList`, plus `OrganizerRegistrationPage` and `ReportGenerateModal` (form selects — leave those; only list filters migrate).

### Estimated implementation time
**3.0 dev-days** (toolbar + 4 field types + URL hook + mobile sheet + tests). Backend param support is **separate** and gates the full bug fix.

---

## 3. PageStats

A standardized KPI strip — the dashboard's `StatsGrid` pattern promoted to a reusable primitive so every page can show headline metrics in one visual language. Wraps the existing `StatCard` (keep it; just relocate to `ui/stats/`).

### Component architecture
- Config-driven: an array of stat items → responsive grid of `StatCard`.
- Owns the grid (`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`), skeleton loading, and a `compact` variant (smaller cards for non-dashboard pages).
- No data logic — consumer supplies resolved values.

### Props interface

```ts
// src/shared/ui/stats/PageStats.tsx
import type { LucideIcon } from "lucide-react";

export interface StatItem {
  key: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "primary" | "blue" | "amber" | "emerald" | "purple" | "error";
  trend?: { value: number; isUp: boolean; subtitle?: string };
}

export interface PageStatsProps {
  items: StatItem[];
  columns?: 2 | 3 | 4;          // default 4
  isLoading?: boolean;          // renders StatCard skeletons
  variant?: "cards" | "compact";
  className?: string;
}
```

### Design guidelines
- Reuse `StatCard` exactly (token-based icon backgrounds already defined). `compact` variant: `p-4`, value `text-xl`, no sparkline.
- Grid is responsive and gap-consistent with the rest of the app (`gap-4`).
- Skeleton = `StatCard`-shaped pulse blocks so layout never shifts on load.

### Example code

```tsx
"use client";
import { StatCard } from "./StatCard";
import { Skeleton } from "@/shared/ui/Skeleton";
import { cn } from "@/shared/utils/cn";

const COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

export function PageStats({ items, columns = 4, isLoading, variant = "cards", className }: PageStatsProps) {
  return (
    <div className={cn("grid gap-4", COLS[columns], className)}>
      {isLoading
        ? Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))
        : items.map((s) => (
            <StatCard key={s.key} label={s.label} value={s.value}
                      icon={s.icon} color={s.color} trend={s.trend}
                      className={variant === "compact" ? "[&_p.text-2xl]:text-xl" : undefined} />
          ))}
    </div>
  );
}
```

### Migration strategy
1. Move `StatCard` → `ui/stats/`, re-export from `ui/index.ts` (no consumer breakage).
2. Refactor dashboard `StatsGrid` to render `PageStats` (delete its bespoke grid).
3. Add `PageStats` to high-value list pages (events, participation, submissions) as the `stats` slot of `AppPage`.

### Affected pages
- `StatsGrid` (dashboard) — refactor onto `PageStats`.
- New adopters: Events, Participation, Sport/Category submissions index pages (review queues benefit most from KPI counts).

### Estimated implementation time
**1.0 dev-day**.

---

## 4. AppTable improvements

Collapse the **3 table implementations** into one `AppTable` by evolving the existing `DataTable` (keep its proven render-prop column API and mobile card mode). Add the enterprise features the audit calls out: **server-driven sorting, row selection for bulk actions, sticky header, density, and integrated pagination/states**.

> **No `@tanstack/react-table`.** The user froze the framework set and base-ui. We extend the in-house `DataTable` — it already handles responsive cards, skeletons, a11y row interaction. We add sorting/selection as controlled props (server-driven), which is all the gov workflows need. See [Decision Log](#decision-log).

### Component architecture
- Backward-compatible superset of `DataTableColumn<T>`: add `sortable`, `sortKey`, `width`, `sticky`.
- **Controlled sort** (`sort` + `onSortChange`) — emits the active column/direction so the page puts it in the query key (server sorts). No client sort over partial pages.
- **Controlled selection** (`selection` + `onSelectionChange`) via a `useTableSelection` helper — header checkbox (select-page), per-row checkbox, indeterminate state → enables a **bulk action bar** (`TableToolbar`).
- Integrated `pagination`, `isLoading` (skeleton), `isFetching` (dim), empty/error — so pages stop wiring these by hand.
- `density` (`comfortable` | `compact`) for dense review queues.

### Props interface

```ts
// src/shared/ui/table/AppTable.tsx
import type { PaginationState } from "@/shared/ui/Pagination";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T, index: number) => ReactNode);
  align?: "left" | "center" | "right";
  width?: string;                 // e.g. "w-40"
  className?: string;
  hideOnMobile?: boolean;
  mobileLabel?: string;
  sortable?: boolean;
  sortKey?: string;               // server sort field; defaults to accessor key
}

export interface SortState { key: string; dir: "asc" | "desc" }

export interface AppTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;

  /** Server-driven sort */
  sort?: SortState | null;
  onSortChange?: (next: SortState | null) => void;

  /** Row selection → bulk actions */
  selectable?: boolean;
  selection?: Set<string | number>;
  onSelectionChange?: (next: Set<string | number>) => void;
  bulkActions?: ReactNode;        // rendered in sticky TableToolbar when selection > 0

  /** Lifecycle + layout */
  isLoading?: boolean;
  isFetching?: boolean;
  pagination?: PaginationState;
  emptyState?: ReactNode;
  density?: "comfortable" | "compact";
  stickyHeader?: boolean;
  minWidth?: string;
  className?: string;
}
```

### Design guidelines
- Visuals unchanged from `DataTable` (it's already clean): header `text-xs font-semibold uppercase tracking-wider text-muted-text/70`, rows `divide-y divide-border`, hover `bg-accent/40`.
- Sort affordance: header becomes a `button`, shows `ChevronUp/Down` (lucide) on active column; cycles asc → desc → none.
- Selection column: `w-10`, base-ui `Checkbox`; selected rows get `bg-primary-50/40`.
- Sticky header: `sticky top-0 z-10 bg-card` (for tall review queues).
- Bulk bar: when `selection.size > 0`, swap the table's top border region for a `TableToolbar` ("N selected" + `bulkActions`).
- Pagination uses the **existing** `Pagination` component (already 1-indexed) — finally adopted everywhere via this prop.

### Example code (sortable header + selection wiring, abridged)

```tsx
function HeaderCell<T>({ col, sort, onSortChange }: {
  col: Column<T>; sort?: SortState | null; onSortChange?: (s: SortState | null) => void;
}) {
  if (!col.sortable) return <th className="px-5 py-3.5 …">{col.header}</th>;
  const key = col.sortKey ?? String(col.accessor);
  const active = sort?.key === key;
  const next: SortState | null =
    !active ? { key, dir: "asc" } : sort!.dir === "asc" ? { key, dir: "desc" } : null;
  return (
    <th className="px-5 py-3.5 …">
      <button onClick={() => onSortChange?.(next)} className="inline-flex items-center gap-1 hover:text-heading">
        {col.header}
        {active && (sort!.dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
      </button>
    </th>
  );
}
```

```ts
// src/shared/ui/table/useTableSelection.ts
export function useTableSelection<T>(rows: T[], rowKey: (r: T) => string | number) {
  const [selection, setSelection] = useState<Set<string | number>>(new Set());
  const allOnPage = rows.length > 0 && rows.every((r) => selection.has(rowKey(r)));
  const toggle = (id: string | number) =>
    setSelection((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePage = () =>
    setSelection((s) => {
      const n = new Set(s);
      allOnPage ? rows.forEach((r) => n.delete(rowKey(r))) : rows.forEach((r) => n.add(rowKey(r)));
      return n;
    });
  return { selection, setSelection, toggle, togglePage, allOnPage };
}
```

### Migration strategy
1. Create `AppTable` as a superset; have `DataTable` re-export a thin wrapper (old API → new component) so **all 10 current `DataTable` consumers keep working unchanged**.
2. Migrate the **9 raw `<table>`** components to `AppTable` columns — biggest consistency win (these are the off-pattern surfaces: `SubmissionDetail`, `CategoryParticipantTable`, `ByNumberSportsTable`, etc.).
3. Turn on `sortable`/`selectable` per page as backend sort and bulk endpoints land (selection is UI-ready; bulk actions gated on backend).

### Affected pages
- **10 via wrapper (no change):** all current `DataTable` users.
- **9 to convert:** raw-`<table>` components listed in the audit (`ByNumberReviewStep`, `ByNumberSportsTable`, `CategorySubmissionDetail`, `EventSportOrgManager`, `SurveyStatusBoard`, `OrganizerRoleManager`, `SubmissionDetail`, `CategoryList`, `CategoryParticipantTable`).
- **4 via ListPage shim:** unaffected, inherit improvements automatically.

### Estimated implementation time
**3.5 dev-days** (sort + selection + sticky + density + Pagination integration + back-compat wrapper + tests).

---

## 5. Sidebar redesign

The sidebar is already good (data-driven sections, collapse persistence, mobile drawer, role filtering via `FEATURE_ACCESS`). The redesign **tightens and extends** it into the enterprise navigation spine — it is not a rewrite.

### Component architecture
- **Single nav source of truth:** extract `MENU_SECTIONS` into `src/core/navigation/nav-config.ts` (typed `NavSection[]`), co-located with the `FeatureKey`/`FEATURE_ACCESS` it already keys off. TopBar breadcrumbs (currently a **separate hardcoded `BREADCRUMB_MAP`**) derive from the **same** config — eliminating the duplication and drift between nav and breadcrumbs.
- Keep `Sidebar` / `SidebarNav` / `SidebarBrand` split.
- **Add a footer block** (`SidebarFooter`): collapsed-aware, holds a **⌘K command-palette trigger** and the language/account affordance shape (account stays in TopBar; sidebar footer hosts the palette + version).
- Section labels become part of the config (`section.titleKey`) instead of the positional `SECTION_LABELS` map.

### Props / config interface

```ts
// src/core/navigation/nav-config.ts
import type { FeatureKey } from "@/core/auth";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  labelKey: string;     // nav.* i18n key (also used for breadcrumb)
  href: string;
  icon: LucideIcon;
  feature: FeatureKey;  // drives both visibility AND breadcrumb label
}
export interface NavSection { titleKey: string; items: NavItem[] }

export const NAV: NavSection[] = [
  { titleKey: "main",         items: [ /* dashboard */ ] },
  { titleKey: "management",   items: [ /* events, sports, orgs, federations, users */ ] },
  { titleKey: "registration", items: [ /* by-sport, by-number, survey, register, leader */ ] },
  { titleKey: "oversight",    items: [ /* organizer, roles, registrations, submissions, reports */ ] },
];

// Derived helpers (replace TopBar's BREADCRUMB_MAP):
export function findNavByPath(pathname: string): NavItem | undefined;
export function visibleSections(role: UserRole): NavSection[];
```

### Design guidelines
- Keep current widths (`240px` / `68px` collapsed) and the active treatment (`bg-primary-50 text-primary` + left accent bar) — it's on-brand.
- Section headers: `text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50` (already used). Drive label from config.
- Collapsed: icon-only with tooltips (already present) + the accent pill. Footer collapses the ⌘K trigger to an icon.
- ⌘K trigger: a button styled like a faux search input (`bg-muted border-border text-muted-text` + `⌘K` kbd chip) when expanded; opens a base-ui `Dialog` command palette (palette itself is W4 scope, trigger ships now).

### Example (footer + ⌘K trigger)

```tsx
function SidebarFooter({ collapsed, onCommand }: { collapsed: boolean; onCommand: () => void }) {
  return (
    <div className="shrink-0 border-t border-border p-3">
      <button onClick={onCommand}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-text hover:bg-accent">
        <Search className="size-4 shrink-0" />
        {!collapsed && <>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-card px-1.5 text-[11px]">⌘K</kbd>
        </>}
      </button>
    </div>
  );
}
```

### Migration strategy
1. Move `MENU_SECTIONS` → `core/navigation/nav-config.ts` with `titleKey`s; update `Sidebar` to consume it (behavior-identical).
2. Refactor `TopBar.getBreadcrumbs` to use `findNavByPath` from the same config; delete `BREADCRUMB_MAP`. (Keeps the existing org-specific `participation→leaderRegistration` override as a small mapping table.)
3. Add `SidebarFooter` with ⌘K trigger (wired to a no-op/placeholder dialog until the palette lands).

### Affected pages
Global — every portal page renders through `PortalShell`. No page-level edits; risk is contained to nav/breadcrumb config.

### Estimated implementation time
**2.5 dev-days** (config extraction + breadcrumb unification + footer/⌘K trigger + regression pass across roles).

---

## 6. Typography standardization

Headings and text are currently ad-hoc Tailwind strings repeated everywhere (`text-xl font-bold text-heading leading-snug tracking-tight`, `text-sm text-muted-text leading-relaxed`, …). Standardize into a **semantic type scale** so every screen speaks the same typographic language — and so **Khmer (kh)** renders with correct font/line-height (next-intl en+kh).

### Component architecture
Two complementary layers:
1. **CSS layer** (`@layer components` in `globals.css`): semantic utility classes — `.type-display`, `.type-h1…h3`, `.type-title`, `.type-body`, `.type-label`, `.type-caption`, `.type-mono`. These standardize size/weight/leading/tracking/color and apply Khmer adjustments via `:lang(km)`.
2. **`Text` / `Heading` components**: typed wrappers that pick the right element + class. Optional but preferred for new code; the CSS classes let existing markup adopt incrementally without importing a component.

### Props interface

```ts
// src/shared/ui/typography/Text.tsx
export type TextVariant =
  | "display" | "h1" | "h2" | "h3" | "title"
  | "body" | "body-sm" | "label" | "caption" | "mono";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;                 // override element (default per variant)
  variant?: TextVariant;            // default "body"
  color?: "heading" | "body" | "muted" | "primary" | "danger" | "inherit";
  weight?: "normal" | "medium" | "semibold" | "bold";
  truncate?: boolean;
  className?: string;
}

// Heading is Text with variant locked to display/h1..h3 and a semantic tag.
```

### Design guidelines — the scale (token-backed)

| Variant | Element | Classes |
|---------|---------|---------|
| display | h1 | `text-3xl font-bold tracking-tight text-heading leading-tight` |
| h1 | h1 | `text-2xl font-bold tracking-tight text-heading leading-snug` |
| h2 | h2 | `text-xl font-semibold text-heading leading-snug` |
| h3 | h3 | `text-base font-semibold text-heading` |
| title | div | `text-sm font-semibold text-heading` |
| body | p | `text-sm text-body leading-relaxed` |
| body-sm | p | `text-xs text-body leading-relaxed` |
| label | span | `text-xs font-medium uppercase tracking-wider text-muted-text` |
| caption | span | `text-xs text-muted-text leading-relaxed` |
| mono | span | `font-mono text-sm tabular-nums` |

- Colors map to existing tokens (`text-heading`, `text-body`, `text-muted-text`, `text-primary`, `text-danger`).
- **Khmer:** add a Khmer webfont (e.g. Noto Sans Khmer via `next/font`) and bump line-height for `:lang(km)` — Khmer glyphs clip at tight leading. One place, applied through the scale.
- `tabular-nums` on `mono`/stat values so numbers align in tables.

### Example code

```css
/* globals.css */
@layer components {
  .type-h1     { @apply text-2xl font-bold tracking-tight text-heading leading-snug; }
  .type-body   { @apply text-sm text-body leading-relaxed; }
  .type-label  { @apply text-xs font-medium uppercase tracking-wider text-muted-text; }
  /* … */
  :lang(km) .type-h1, :lang(km) .type-body { @apply leading-loose; }
}
```

```tsx
// src/shared/ui/typography/Text.tsx
const VARIANT: Record<TextVariant, { tag: ElementType; cls: string }> = {
  h1:    { tag: "h1",   cls: "type-h1" },
  body:  { tag: "p",    cls: "type-body" },
  label: { tag: "span", cls: "type-label" },
  /* … */
} as never;

export function Text({ as, variant = "body", truncate, className, ...rest }: TextProps) {
  const { tag, cls } = VARIANT[variant];
  const Comp = as ?? tag;
  return <Comp className={cn(cls, truncate && "truncate", className)} {...rest} />;
}
```

### Migration strategy
1. Land the `@layer components` scale + `Text`/`Heading` + Khmer font (foundation, zero breakage).
2. Refactor the shared primitives first — `PageHeader`, `DetailHeader`, `StatCard`, `AppTable`, `Pagination` — to use the scale. Because everything renders through these, the whole app inherits consistency in one move.
3. Lint rule / code-review checklist: new code uses `Text`/`type-*`, not raw font strings. Sweep modules opportunistically.

### Affected pages
Foundation-level → **every** page. Concentrated edits in the ~8 shared primitives deliver most of the visible win.

### Estimated implementation time
**1.5 dev-days** (scale + components + Khmer font + refactor shared primitives).

---

## 7. DetailPage template

A standardized scaffold for every **entity detail / review** screen, mirroring `AppPage` for collections. Today detail screens are hand-built; `DetailHeader` exists but the surrounding layout (back link, main/aside grid, action bar, states) is re-implemented each time — and the audit flags **5 divergent review/approve surfaces**. `DetailPage` unifies them.

### Component architecture
- Composes the **existing** `BackLink` + `DetailHeader` (reuse, don't replace) + a **two-column content grid** (main + sticky aside) + an optional **sticky action bar** + the same loading/error/not-found states from `shared/ui/page/`.
- Optional **tabs** (base-ui `Tabs`) for multi-section entities (Overview / Participants / History).
- `aside` slot is the home for **metadata panels and the future audit/activity timeline** the audit wants — one consistent place across all detail screens.
- Action bar (`primaryActions`) is where Approve / Reject / Request-revision live → unifies the 5 review surfaces behind one layout + one `StatusBadge`.

### Props interface

```ts
// src/shared/ui/page/DetailPage.tsx
import type { EntityStatus } from "@/shared/ui/StatusBadge";

export interface DetailTab { key: string; label: string; content: ReactNode; count?: number }

export interface DetailPageProps {
  backHref: string;
  backLabel: string;

  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  description?: string;
  status?: EntityStatus;          // renders unified StatusBadge in header
  meta?: ReactNode;               // key/value chips under title

  primaryActions?: ReactNode;     // approve / reject / edit → sticky action bar
  tabs?: DetailTab[];             // if present, renders tabbed body
  children?: ReactNode;           // main column when no tabs
  aside?: ReactNode;              // right rail: metadata, timeline

  isLoading?: boolean;
  error?: Error | null;
  notFound?: boolean;
  maxWidth?: "default" | "wide" | "narrow";
  className?: string;
}
```

### Design guidelines
- Width via `PageShell` (`narrow`/`default`). Vertical rhythm `space-y-6`.
- Layout: `grid gap-6 lg:grid-cols-[1fr_320px]` — main left, aside right; collapses to single column on mobile (aside moves below).
- Header reuses `DetailHeader` card (`rounded-lg border bg-card p-6 shadow-sm`); inject `StatusBadge` next to the title for instant state read.
- Action bar: sticky `bottom-0` bar (`border-t bg-card/95 backdrop-blur`) on mobile; inline in header on desktop — actions never scroll out of reach in long review pages.
- States: `notFound` → `PageNotFound`; `error` → `PageErrorState`; `isLoading` → header skeleton + body skeleton (no layout shift).

### Example code

```tsx
"use client";
import { PageShell } from "@/shared/layout";
import { BackLink } from "@/shared/ui/page/BackLink";
import { DetailHeader } from "@/shared/ui/page/DetailHeader";
import { PageNotFound, PageErrorState } from "@/shared/ui/page";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Tabs } from "@base-ui/react/tabs";

export function DetailPage(p: DetailPageProps) {
  if (p.notFound) return <PageNotFound />;
  return (
    <PageShell size={p.maxWidth ?? "default"} className={p.className}>
      {p.error ? <PageErrorState title={p.title} description={p.error.message} /> : (
        <>
          <DetailHeader
            backHref={p.backHref} backLabel={p.backLabel}
            eyebrow={p.eyebrow} eyebrowIcon={p.eyebrowIcon}
            title={p.title} description={p.description}
            meta={<>{p.status && <StatusBadge status={p.status} />}{p.meta}</>}
            action={p.primaryActions}
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
              {p.tabs ? (
                <Tabs.Root defaultValue={p.tabs[0]?.key}>
                  <Tabs.List className="flex gap-1 border-b border-border">
                    {p.tabs.map((t) => (
                      <Tabs.Tab key={t.key} value={t.key}
                        className="px-4 py-2.5 text-sm font-medium text-muted-text data-[selected]:text-primary data-[selected]:border-b-2 data-[selected]:border-primary">
                        {t.label}{typeof t.count === "number" && ` (${t.count})`}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                  {p.tabs.map((t) => <Tabs.Panel key={t.key} value={t.key} className="pt-6">{t.content}</Tabs.Panel>)}
                </Tabs.Root>
              ) : p.children}
            </div>
            {p.aside && <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">{p.aside}</aside>}
          </div>
        </>
      )}
    </PageShell>
  );
}
```

### Migration strategy
1. Build `DetailPage` on top of the existing `DetailHeader`/`BackLink` (no breakage to current users of those).
2. Migrate the **5 review surfaces first** (participation, sport-submissions, category-submissions, by-number, org submission) → one layout, one action bar, one `StatusBadge`. This directly resolves the audit's "divergent review surfaces."
3. Then entity details (event, org, sport, user). The `aside` slot is where the W4 **audit/activity timeline** plugs in later — no further layout work.

### Affected pages
`SubmissionDetail`, `OrgSubmissionDetail`, `CategorySubmissionDetail`, `CategorySportDetail`, `ParticipationOrgDetail`, by-number review, plus event/org/sport/user detail screens.

### Estimated implementation time
**2.0 dev-days** (template + tabs + sticky action bar + states; migration of review surfaces counted under the migration line).

---

## Phased rollout (maps to the audit's 4-week roadmap)

| Week | Deliverables | Items |
|------|--------------|-------|
| **W1 — Foundations** | Typography scale + `Text`/`Heading` + Khmer font; `PageStats`; `AppPage` + `ListPage` shim | 6, 3, 1 |
| **W2 — Workhorses** | `AppTable` (sort/select/sticky) + `DataTable` back-compat wrapper; migrate raw-`<table>` surfaces; refactor shared primitives onto type scale | 4, 6 |
| **W3 — Filtering & Nav** | `FilterToolbar` + `useFilterState` (URL); migrate list filters; sidebar config extraction + breadcrumb unification + ⌘K trigger | 2, 5 |
| **W4 — Detail & Review** | `DetailPage`; migrate the 5 review surfaces; aside-slot timeline placeholder | 7 |

Sequencing rationale: typography + `AppPage` first because they're zero-risk foundations every later item renders through; `AppTable` before `FilterToolbar` so filtered queries have a table that can sort/select; `DetailPage` last because it consumes the unified `StatusBadge` + states from earlier weeks.

### Backend dependencies (flagged — out of scope here)
- List endpoints need `status` / `search` / `sort` / pagination params to **fully** fix the client-side filter bug (item 2/4). Until then filters are wired but degrade gracefully.
- Bulk-action endpoints gate `AppTable` selection's *actions* (the selection UI ships regardless).
- An audit/activity feed endpoint feeds the `DetailPage` aside timeline (W4+).

---

## Decision Log

- **No `@tanstack/react-table`.** Framework set is frozen and the in-house `DataTable` already covers responsive cards, skeletons, and a11y. Server-driven sort/selection as controlled props meets every government workflow need without a 14 kB dependency or a rewrite of 19 column definitions. Revisit only if client-side grouping/virtualization becomes a hard requirement.
- **URL as filter state (no `nuqs`).** Built on Next's `useSearchParams`/`useRouter` — shareable filtered views, correct back-button, and React Query keys derive from the URL for free. No dependency added.
- **Evolve, don't replace.** `ListPage`→`AppPage`, `DataTable`→`AppTable`, `DetailHeader`→`DetailPage`, `StatCard`→`PageStats` are all **supersets with back-compat shims**, so the ~23 current consumers keep working and migration is incremental and reviewable one module per PR.
- **Tokens are law.** Every component consumes the existing `globals.css` tokens; the plan adds **zero** new colors and changes no token values.
```
