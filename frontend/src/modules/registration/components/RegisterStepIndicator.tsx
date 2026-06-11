'use client';

import { CheckCircle2 } from 'lucide-react';

interface RegisterStepIndicatorProps {
  steps: readonly string[];
  stepIndex: number;
  progress: number;
  stepLabels: Record<string, string>;
  onStepClick: (step: string) => void;
}

export function RegisterStepIndicator({
  steps,
  stepIndex,
  progress,
  stepLabels,
  onStepClick,
}: RegisterStepIndicatorProps) {
  return (
    <div className="mb-10">
      <div className="flex justify-between mb-5">
        {steps.map((step, idx) => (
          <div key={step} className="flex flex-col items-center flex-1 gap-2">
            <button type="button" onClick={() => onStepClick(step)} disabled={idx > stepIndex}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200 ${idx < stepIndex ? 'bg-primary text-primary-foreground' : idx === stepIndex ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'border border-border bg-card text-muted-foreground cursor-not-allowed'}`}>
              {idx < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </button>
            <span className={`hidden max-w-20 text-center text-xs leading-relaxed sm:block ${idx <= stepIndex ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
              {stepLabels[step]}
            </span>
          </div>
        ))}
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
