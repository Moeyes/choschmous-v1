'use client';

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface SelectableGridOption {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

interface SelectableGridProps {
  options: SelectableGridOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function SelectableGrid({
  options,
  value,
  onChange,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className,
}: SelectableGridProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      search.trim()
        ? options.filter((opt) =>
            opt.label.toLowerCase().includes(search.toLowerCase()),
          )
        : options,
    [options, search],
  );

  const selected = options.find((opt) => opt.value === value);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {options.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((option) => {
            const Icon = option.icon;
            const isSelected = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(isSelected ? null : option.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center transition-all',
                  'hover:border-primary/40 hover:shadow-sm',
                  isSelected
                    ? 'border-primary bg-primary-50/40 shadow-sm'
                    : 'border-border',
                )}
              >
                {Icon && (
                  <div className="relative flex size-10 items-center justify-center rounded-lg bg-primary-50">
                    <Icon className="size-5 text-primary" />
                    {isSelected && (
                      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                        ✓
                      </span>
                    )}
                  </div>
                )}
                <span className="text-xs font-medium text-foreground leading-tight">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-50/50 px-3 py-1 text-xs font-medium text-primary">
            {selected.label}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/10"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
