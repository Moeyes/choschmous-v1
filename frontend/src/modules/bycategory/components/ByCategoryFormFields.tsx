'use client';

import { UseFormReturn } from 'react-hook-form';
import type { ByCategoryFormInput, ByCategoryFormData, Event } from '../types';
import { ByCategoryEventStep } from './ByCategoryEventStep';
import { ByCategorySportStep } from './ByCategorySportStep';
import { ByCategoryCategoriesStep } from './ByCategoryCategoriesStep';
import { ByCategoryReviewStep } from './ByCategoryReviewStep';

type Step = 'event' | 'sport' | 'categories' | 'review';

interface ByCategoryFormFieldsProps {
  form: UseFormReturn<ByCategoryFormInput, unknown, ByCategoryFormData>;
  events: Event[];
  sportName: string;
  step: Step;
  onCopyFromPrevious: () => Promise<void>;
  hasPrevious: boolean;
  copyPending: boolean;
}

export function ByCategoryFormFields({
  form,
  events,
  sportName,
  step,
  onCopyFromPrevious,
  hasPrevious,
  copyPending,
}: ByCategoryFormFieldsProps) {
  if (step === 'event')
    return <ByCategoryEventStep form={form} events={events} />;

  if (step === 'sport')
    return <ByCategorySportStep sportName={sportName} />;

  if (step === 'categories')
    return (
      <ByCategoryCategoriesStep
        form={form}
        onCopyFromPrevious={onCopyFromPrevious}
        hasPrevious={hasPrevious}
        copyPending={copyPending}
      />
    );

  if (step === 'review')
    return <ByCategoryReviewStep form={form} events={events} sportName={sportName} />;

  return null;
}
