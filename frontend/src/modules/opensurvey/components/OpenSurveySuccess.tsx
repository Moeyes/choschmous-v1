'use client';

import { useTranslations } from 'next-intl';
import { Check, RotateCcw } from 'lucide-react';
import { Card, Button } from '@/shared';

interface OpenSurveySuccessProps {
  onFillAnother?: () => void;
}

export function OpenSurveySuccess({ onFillAnother }: OpenSurveySuccessProps) {
  const t = useTranslations('opensurvey.success');
  return (
    <div className="mx-auto max-w-lg">
      <Card className="overflow-hidden text-center">
        <div className="bg-gradient-to-b from-success/10 to-success/5 px-8 pb-8 pt-12">
          <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-success shadow-lg shadow-success/20">
            <Check className="size-9 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {onFillAnother && (
          <div className="border-t border-border px-6 py-5">
            <Button variant="default" className="w-full gap-2" size="lg" onClick={onFillAnother}>
              <RotateCcw className="size-4" />
              {t('another')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
