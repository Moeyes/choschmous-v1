"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface StepIndicatorProps {
  /** Ordered step labels (already localized). */
  steps: readonly string[];
  /** Zero-based index of the active step. */
  currentIndex: number;
  /** Called with the clicked step index. */
  onStepClick?: (index: number) => void;
}

export function StepIndicator({
  steps,
  currentIndex,
  onStepClick,
}: StepIndicatorProps) {
  const total = steps.length;
  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      {/* Step circles & connectors */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full bg-border" />
        {steps.map((_, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isReachable = index <= currentIndex;

          return (
            <button
              key={index}
              type="button"
              onClick={() => onStepClick?.(index)}
              disabled={!isReachable}
              className={cn(
                "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                  : isCompleted
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground",
                isReachable ? "cursor-pointer" : "cursor-not-allowed",
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step labels — full labels on >= sm, condensed to the active step on mobile */}
      <div className="hidden justify-between gap-2 sm:flex">
        {steps.map((step, index) => (
          <p
            key={index}
            className={cn(
              "max-w-20 flex-1 text-center text-xs leading-relaxed transition-colors",
              index <= currentIndex
                ? "font-medium text-primary"
                : "text-muted-foreground",
            )}
          >
            {step}
          </p>
        ))}
      </div>
      <p className="text-center text-xs font-medium leading-relaxed text-primary sm:hidden">
        {currentIndex + 1}/{total} · {steps[currentIndex]}
      </p>
    </div>
  );
}
