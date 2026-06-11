'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';
import { Button } from '@/shared';

interface RegisterFormNavButtonsProps {
  isFirstStep: boolean;
  isReviewStep: boolean;
  isPending: boolean;
  registerWindowError: string | null;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function RegisterFormNavButtons({
  isFirstStep,
  isReviewStep,
  isPending,
  registerWindowError,
  onBack,
  onNext,
  onSubmit,
}: RegisterFormNavButtonsProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('registration');

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        variant="outline"
        size="lg"
        onClick={onBack}
        disabled={isFirstStep}
      >
        <ArrowLeft className="size-4" />
        {tCommon('back')}
      </Button>
      {isReviewStep ? (
        <Button
          variant="default"
          size="lg"
          onClick={onSubmit}
          disabled={isPending || !!registerWindowError}
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
          disabled={!!registerWindowError}
        >
          {tCommon('next')}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
