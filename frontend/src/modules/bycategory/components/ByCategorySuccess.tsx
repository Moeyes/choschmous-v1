'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared';

interface ByCategorySuccessProps {
  onRegisterAnother: () => void;
}

export function ByCategorySuccess({ onRegisterAnother }: ByCategorySuccessProps) {
  const t = useTranslations('bycategory');

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card p-12 text-center shadow-sm">
      <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="size-8 text-success" />
      </div>
      <h2 className="text-xl font-bold text-foreground">{t('success.title')}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t('success.description')}</p>
      <Button variant="outline" onClick={onRegisterAnother}>
        <ArrowLeft className="mr-2 size-4" />
        {t('success.another')}
      </Button>
    </div>
  );
}
