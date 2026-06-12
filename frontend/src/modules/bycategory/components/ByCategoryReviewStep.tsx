'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CalendarDays, ShieldCheck, ListChecks } from 'lucide-react';
import type { ByCategoryFormInput, ByCategoryFormData, Event } from '../types';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/shared';

interface ByCategoryReviewStepProps {
  form: UseFormReturn<ByCategoryFormInput, unknown, ByCategoryFormData>;
  events: Event[];
  sportName: string;
}

export function ByCategoryReviewStep({ form, events, sportName }: ByCategoryReviewStepProps) {
  const t = useTranslations('bycategory');
  const watch = form.watch;
  const selectedEventId = watch('eventId');
  const categories = watch('categories') || [];

  const event = events.find((e) => e.id === selectedEventId);

  const genderLabel = (g: string) => {
    if (g === 'MALE') return t('genders.male');
    if (g === 'FEMALE') return t('genders.female');
    return t('genders.mixed');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle icon={CalendarDays}>{t('steps.event.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{event?.name_kh || `#${selectedEventId}`}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={ShieldCheck}>{t('steps.sport.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{sportName}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={ListChecks}>{t('review.categories')}</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('review.noCategories')}</p>
          ) : (
            <div className="divide-y divide-border">
              {categories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="font-medium">{cat.name}</span>
                  <Badge variant="secondary" size="sm">
                    {genderLabel(cat.gender)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
