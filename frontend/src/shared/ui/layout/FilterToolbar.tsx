"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/utils/cn";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/** A single choice rendered inside a {@link FilterConfig} dropdown. */
interface FilterOption {
  /** Stable value persisted to state / the URL query string. */
  value: string;
  /** Pre-translated, human-readable label (e.g. `t("statusFilter.all")`). */
  label: string;
}

/** One `<Select>` filter rendered in the toolbar. */
interface FilterConfig {
  /** Stable identifier. Also used as the URL param key when syncing. */
  key: string;
  /** Currently selected value (controlled). */
  value: string;
  /**
   * Selectable options. Convention: the **first** option is the "all / any"
   * reset value — it is what {@link FilterToolbarProps.onClear} resets to and
   * what decides whether the Clear button is shown (see `clearValue`).
   */
  options: FilterOption[];
  /** Fires with the newly selected value. */
  onChange: (value: string) => void;
  /** Trigger placeholder shown when nothing matches `value`. */
  placeholder?: string;
  /**
   * Value treated as "inactive" when deciding whether Clear appears.
   * @default options[0]?.value
   */
  clearValue?: string;
  /** Accessible label for the trigger. @default `key` */
  ariaLabel?: string;
  /** Width / layout override for the trigger. @default `"w-full sm:w-48"` */
  className?: string;
}

/** Search box configuration. */
interface FilterSearchConfig {
  /** Current query (controlled). */
  value: string;
  /** Fires with the new query on every keystroke. */
  onChange: (value: string) => void;
  /** Pre-translated placeholder. @default `common.search` */
  placeholder?: string;
  /** Accessible label for the input. @default `common.search` */
  ariaLabel?: string;
}

interface FilterToolbarProps {
  /** Free-text search box. Omit to render no search field. */
  search?: FilterSearchConfig;
  /** Zero or more `<Select>` filters. */
  filters?: FilterConfig[];
  /** Right-aligned action slot (e.g. a create `<Button>`). */
  actions?: ReactNode;
  /**
   * Resets every control. When provided, a "Clear" button appears while any
   * control is active. Implement it to reset your search + filter state back to
   * their defaults.
   */
  onClear?: () => void;
  /** Pre-translated clear label. @default `common.clear` */
  clearLabel?: string;
  /** Class override for the toolbar root. */
  className?: string;
}

/**
 * `FilterToolbar` is the V1 standard search + filter bar for list pages.
 *
 * It replaces the hand-rolled
 * `flex flex-col gap-3 sm:flex-row` → `<Input> + <select>` clusters that each
 * list page used to copy-paste (some of which bypassed the design-system
 * {@link Select} entirely with a raw native `<select>`).
 *
 * Mobile-first: controls stack full-width on phones and flow into a single row
 * from `sm` up, with `actions` (and Clear) pushed to the trailing edge.
 *
 * ```tsx
 * <FilterToolbar
 *   search={{ value: q, onChange: setQ, placeholder: t("search") }}
 *   filters={[
 *     {
 *       key: "status",
 *       value: status,
 *       onChange: setStatus,
 *       options: [
 *         { value: "all", label: t("statusFilter.all") },
 *         { value: "APPROVED", label: t("statusFilter.approved") },
 *       ],
 *     },
 *   ]}
 *   onClear={() => { setQ(""); setStatus("all"); }}
 *   actions={<Button>{t("create")}</Button>}
 * />
 * ```
 *
 * Notes:
 * - Reuses the existing {@link Input} and {@link Select}; adds no new tokens,
 *   styles, or dependencies.
 * - Takes pre-translated strings (next-intl friendly); falls back to the shared
 *   `common.*` keys for the search placeholder and Clear label.
 * - For URL-synced filters (`?search=…&status=…`) see {@link useUrlFilters}.
 */
export function FilterToolbar({
  search,
  filters = [],
  actions,
  onClear,
  clearLabel,
  className,
}: FilterToolbarProps) {
  const t = useTranslations("common");

  const searchActive = !!search && search.value.trim() !== "";
  const filtersActive = filters.some(
    (filter) => filter.value !== (filter.clearValue ?? filter.options[0]?.value),
  );
  const showClear = !!onClear && (searchActive || filtersActive);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      {search && (
        <div className="relative flex-1 sm:min-w-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
          <Input
            type="text"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? t("search")}
            aria-label={search.ariaLabel ?? search.placeholder ?? t("search")}
            className="pl-9"
          />
        </div>
      )}

      {filters.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {filters.map((filter) => {
            const selected = filter.options.find(
              (option) => option.value === filter.value,
            );
            return (
              <Select
                key={filter.key}
                value={filter.value}
                onValueChange={(value) => filter.onChange(value ?? "")}
              >
                <SelectTrigger
                  aria-label={filter.ariaLabel ?? filter.key}
                  className={cn("w-full sm:w-48", filter.className)}
                >
                  <SelectValue>
                    {selected?.label ?? filter.placeholder ?? t("filters")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
        </div>
      )}

      {(showClear || actions) && (
        <div className="flex items-center gap-2 sm:ml-auto">
          {showClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
              {clearLabel ?? t("clear")}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
