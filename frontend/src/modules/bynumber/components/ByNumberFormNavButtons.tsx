'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { Button } from '@/shared';

interface ByNumberFormNavButtonsProps {
  stepIndex: number;
  isReview: boolean;
  isPending: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function ByNumberFormNavButtons({
  stepIndex,
  isReview,
  isPending,
  onPrevious,
  onNext,
}: ByNumberFormNavButtonsProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('bynumber');

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        variant="outline"
        size="lg"
        onClick={onPrevious}
        disabled={stepIndex === 0}
      >
        <ArrowLeft className="size-4" />
        {tCommon('previous')}
      </Button>
      {isReview ? (
        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={isPending}
          className="bg-success hover:bg-success/90"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {isPending ? t('submitting') : t('submit')}
        </Button>
      ) : (
        <Button
          variant="default"
          size="lg"
          onClick={onNext}
        >
          {tCommon('next')}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
