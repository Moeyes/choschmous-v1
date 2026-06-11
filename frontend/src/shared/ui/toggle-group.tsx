'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface ToggleGroupOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface ToggleGroupProps {
  options: ToggleGroupOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  className?: string;
}

export function ToggleGroup({ options, value, onChange, className }: ToggleGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-lg border border-input bg-background',
        className,
      )}
    >
      {options.map((option, i) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all',
              i < options.length - 1 && 'border-r border-input',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground hover:bg-accent',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
