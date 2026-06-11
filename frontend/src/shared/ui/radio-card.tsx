'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

interface RadioCardGroupProps {
  options: RadioCardOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  className?: string;
}

interface RadioCardProps {
  option: RadioCardOption;
  isSelected: boolean;
  onSelect: () => void;
}

function RadioCard({ option, isSelected, onSelect }: RadioCardProps) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all',
        'hover:border-primary/40 hover:shadow-sm',
        isSelected
          ? 'border-primary bg-primary-50/30 shadow-sm'
          : 'border-border',
      )}
    >
      {Icon && (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
          <Icon className="size-5 text-primary" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{option.label}</span>
        {option.description && (
          <span className="text-xs text-muted-foreground">{option.description}</span>
        )}
      </div>
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
        )}
      >
        {isSelected && <span className="size-2 rounded-full bg-white" />}
      </span>
    </button>
  );
}

export function RadioCardGroup({ options, value, onChange, className }: RadioCardGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}
    >
      {options.map((option) => (
        <RadioCard
          key={option.value}
          option={option}
          isSelected={value === option.value}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
