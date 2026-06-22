'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/utils/cn';
import { StatCard } from '@/shared/ui/StatCard';
import { SkeletonCard } from '@/shared/ui/Skeleton';

/** Direction of a KPI trend — drives the badge icon + colour in {@link StatCard}. */
type PageStatTrendDirection = 'up' | 'down';

/** Period-over-period delta shown as a pill on a stat card. */
interface PageStatTrend {
  /** Magnitude of the change, rendered as `{value}%`. */
  value: number;
  /** `"up"` shows the green rising badge, `"down"` the red falling one. */
  direction: PageStatTrendDirection;
}

/** Colour token for the icon badge. Mirrors {@link StatCard}'s palette. */
type PageStatColor = 'primary' | 'blue' | 'amber' | 'emerald' | 'purple' | 'error';

/** A single KPI rendered by {@link PageStats}. */
export interface PageStatItem {
  /** Metric label, e.g. `t("totalAthletes")`. Also used as the React key. */
  title: string;
  /** Metric value. Numbers are `toLocaleString()`-formatted by {@link StatCard}. */
  value: string | number;
  /** Leading icon for the badge. */
  icon: LucideIcon;
  /** Optional supporting copy under the value (e.g. `"vs. last month"`). */
  description?: string;
  /** Optional period-over-period delta badge. */
  trend?: PageStatTrend;
  /**
   * Icon-badge colour. When omitted, colours cycle through the design-system
   * default palette by position (matching the legacy dashboard look).
   */
  color?: PageStatColor;
}

interface PageStatsProps {
  /** The KPIs to render, left-to-right. */
  items: PageStatItem[];
  /**
   * Render skeleton placeholders instead of values. Reuses the shared
   * {@link SkeletonCard}, so the loading shape matches a real card exactly.
   */
  loading?: boolean;
  /**
   * Max columns from the `lg` breakpoint up. Always 1 column on mobile and 2
   * from `sm`. @default 4
   */
  columns?: 2 | 3 | 4;
  /**
   * Number of skeletons to show while `loading` with no `items` yet.
   * @default `columns`
   */
  loadingCount?: number;
  /** Class override for the grid container. */
  className?: string;
}

/** Default colour rotation, preserving the legacy dashboard ordering. */
const DEFAULT_COLORS: readonly PageStatColor[] = ['primary', 'emerald', 'amber', 'blue'];

/**
 * Responsive column classes. Tailwind needs static class names, so these are
 * looked up rather than interpolated.
 */
const COLUMNS_CLASS: Record<NonNullable<PageStatsProps['columns']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * `PageStats` is the V1 standard KPI row for dashboards and list pages.
 *
 * It standardises the hand-rolled
 * `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` → mapped
 * {@link StatCard} clusters (and their separately copy-pasted loading
 * skeletons) into one mobile-first, type-safe component. Each item maps onto
 * the existing {@link StatCard}; colours cycle through the design-system
 * palette and cards stagger in with the established entrance animation.
 *
 * ```tsx
 * <PageStats
 *   loading={isLoading}
 *   items={[
 *     {
 *       title: t("totalAthletes"),
 *       value: 15234,
 *       icon: Users,
 *       trend: { value: 12, direction: "up" },
 *     },
 *   ]}
 * />
 * ```
 *
 * Notes:
 * - Reuses {@link StatCard} for cards and {@link SkeletonCard} for the loading
 *   state; adds no new tokens, styles, or dependencies.
 * - Takes pre-translated strings (next-intl friendly).
 * - Pass `columns={3}` when you have three KPIs so the row fills evenly.
 */
export function PageStats({ items, loading = false, columns = 4, loadingCount, className }: PageStatsProps) {
  const gridClassName = cn('grid gap-4', COLUMNS_CLASS[columns], className);

  if (loading) {
    const count = loadingCount ?? (items.length || columns);
    return (
      <div className={gridClassName}>
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      {items.map((item, index) => (
        <div key={item.title || index} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${index * 80}ms` }}>
          <StatCard
            label={item.title}
            value={item.value}
            icon={item.icon}
            description={item.description}
            color={item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            trend={
              item.trend
                ? {
                    value: item.trend.value,
                    isUp: item.trend.direction === 'up',
                  }
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
