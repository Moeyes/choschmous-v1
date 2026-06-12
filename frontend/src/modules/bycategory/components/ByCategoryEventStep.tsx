'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { CalendarDays } from 'lucide-react';
import type { ByCategoryFormInput, ByCategoryFormData, Event } from '../types';
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from '@/shared';

interface ByCategoryEventStepProps {
  form: UseFormReturn<ByCategoryFormInput, unknown, ByCategoryFormData>;
  events: Event[];
}

export function ByCategoryEventStep({ form, events }: ByCategoryEventStepProps) {
  const { watch, setValue, trigger } = form;
  const t = useTranslations('bycategory');
  const selectedEventId = watch('eventId');

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle icon={CalendarDays} subtitle={t('steps.event.subtitle')}>
            {t('steps.event.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            {t('noEvents')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={CalendarDays} subtitle={t('steps.event.subtitle')}>
          {t('steps.event.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioCardGroup
          options={events.map((event) => ({
            value: String(event.id),
            label: event.name_kh,
            icon: CalendarDays,
          }))}
          value={selectedEventId != null ? String(selectedEventId) : null}
          onChange={(id) => {
            setValue('eventId', Number(id));
            trigger('eventId');
          }}
        />
      </CardContent>
    </Card>
  );
}
