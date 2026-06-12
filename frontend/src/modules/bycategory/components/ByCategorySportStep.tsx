'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck, Lock } from 'lucide-react';
import { Card, CardContent, Badge } from '@/shared';

interface ByCategorySportStepProps {
  sportName: string;
}

export function ByCategorySportStep({ sportName }: ByCategorySportStepProps) {
  const t = useTranslations('bycategory');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('steps.sport.lockedLabel')}
            </p>
            <p className="text-lg font-semibold text-foreground">{sportName}</p>
          </div>
          <Badge variant="primary" size="sm" className="gap-1">
            <Lock className="size-3" />
            {t('steps.sport.locked')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
