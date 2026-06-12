'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { Button } from '@/shared';

interface ByCategoryFormNavButtonsProps {
  stepIndex: number;
  totalSteps: number;
  isReview: boolean;
  isPending: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function ByCategoryFormNavButtons({
  stepIndex,
  totalSteps,
  isReview,
  isPending,
  onPrevious,
  onNext,
}: ByCategoryFormNavButtonsProps) {
  const t = useTranslations('bycategory');
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <div>
        {!isFirst && (
          <Button type="button" variant="outline" onClick={onPrevious} disabled={isPending}>
            <ArrowLeft className="mr-2 size-4" />
            {t('nav.back')}
          </Button>
        )}
      </div>
      <div>
        {!isLast ? (
          <Button type="button" onClick={onNext}>
            {t('nav.next')}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Send className="mr-2 size-4" />
            {isPending ? t('nav.submitting') : t('nav.submit')}
          </Button>
        )}
      </div>
    </div>
  );
}
