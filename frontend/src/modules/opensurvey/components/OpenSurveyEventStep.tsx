'use client';

import { useTranslations } from 'next-intl';
import { FormField } from '@/shared/form/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import type { OpenSurveyEvent } from '../schema/opensurvey.schema';

interface OpenSurveyEventStepProps {
  events: OpenSurveyEvent[];
  value: number | null;
  onChange: (eventId: number) => void;
}

export function OpenSurveyEventStep({ events, value, onChange }: OpenSurveyEventStepProps) {
  const t = useTranslations('opensurvey');

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        {t('noEvents')}
      </div>
    );
  }

  return (
    <FormField label={t('eventLabel')} htmlFor="open-survey-event">
      <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id="open-survey-event">
          <SelectValue placeholder={t('eventPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {events.map((event) => (
            <SelectItem key={event.id} value={String(event.id)}>
              {event.name_kh}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
