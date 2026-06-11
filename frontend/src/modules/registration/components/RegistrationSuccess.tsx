'use client';

import { Check, UserPlus, House } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, Button } from '@/shared';

interface RegistrationSuccessProps {
  refNo: string;
  onRegisterAnother: () => void;
  onGoHome: () => void;
}

export function RegistrationSuccess({
  refNo,
  onRegisterAnother,
  onGoHome,
}: RegistrationSuccessProps) {
  const t = useTranslations('registration');
  return (
    <div className="mx-auto max-w-lg">
      <Card className="overflow-hidden text-center">
        <div className="bg-gradient-to-b from-success/10 to-success/5 px-8 pb-8 pt-12">
          <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-success shadow-lg shadow-success/20">
            <Check className="size-9 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t('success.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('success.subtitle')}</p>
        </div>
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4">
            <p className="text-xs font-semibold text-success-700">{t('success.refLabel')}</p>
            <p className="mt-1 text-lg font-bold tracking-wide text-success-800">{refNo}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="default"
              size="lg"
              className="w-full gap-2"
              onClick={onRegisterAnother}
            >
              <UserPlus className="size-4" />
              {t('success.registerAnother')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
              onClick={onGoHome}
            >
              <House className="size-4" />
              {t('success.goHome')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
