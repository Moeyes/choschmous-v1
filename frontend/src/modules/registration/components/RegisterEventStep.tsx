'use client';

import { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Trophy, CalendarDays, Building2, Medal, LayoutGrid, AlertCircle } from 'lucide-react';
import { RegisterFormData, RegisterFormInput } from '../schema/registration.schema';
import type { CascadingDataLoaded, EligibleSport } from '@/core/api/referenceData';
import { useEventSports } from '../hooks/useEventSports';
import { Card, CardHeader, CardTitle, CardContent, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectableGrid } from '@/shared';
import type { SelectableGridOption } from '@/shared';

interface RegisterEventStepProps {
  form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>;
  cascadingData: CascadingDataLoaded | null;
  eligibleSports?: EligibleSport[];
  isAdmin: boolean;
}

export function RegisterEventStep({ form, cascadingData, eligibleSports, isAdmin }: RegisterEventStepProps) {
  const t = useTranslations('registration');
  const tCommon = useTranslations('common');
  const { setValue, watch, formState } = form;
  const errors = formState.errors;

  const eventType = watch('eventType');
  const eventId = watch('eventId');
  const organizationId = watch('organizationId');
  const sportId = watch('sportId');

  const eventTypes = cascadingData?.eventTypes ?? [];
  const events = eventType ? (cascadingData?.events ?? []).filter((e) => e.type === eventType) : [];
  const orgs = cascadingData?.organizations ?? [];
  const allSports = cascadingData?.sports ?? [];

  const selectedEvent = events.find((e) => e.id === eventId);
  const selectedOrg = orgs.find((o) => o.id === Number(organizationId));

  const { data: eventSportsRaw = [] } = useEventSports(eventId);

  // /api/events/{id}/sports returns sports_event.id (join table), not sports.id.
  // Cross-reference by name against allSports to get the real sports.id,
  // which is what the category and other downstream endpoints expect.
  const eventSports = eventSportsRaw.map((es) => {
    const matched = allSports.find((s) => s.name_kh === es.name_kh);
    return matched ? { ...es, id: matched.id } : es;
  });

  const sportOptions: SelectableGridOption[] = !eventId
    ? []
    : eligibleSports && eligibleSports.length > 0
      ? eligibleSports.map((s) => ({
          value: String(s.sports_id),
          label: s.name_kh || s.name_en || 'Sport',
        }))
      : eventSports.map((s) => ({
          value: String(s.id),
          label: s.name_kh || s.name_en || 'Sport',
        }));

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={Trophy} subtitle={t('stepSubtitles.event')}>
          {t('steps.event')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t('fields.eventType')}
              <span className="ml-1 text-destructive">*</span>
            </label>
            <Select
              value={eventType ?? ''}
              onValueChange={(id) => {
                setValue('eventType', id, { shouldValidate: true });
                setValue('eventId', null);
                setValue('categoryId', null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('fields.selectEventType')} />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type: string) => (
                  <SelectItem key={type} value={type} icon={LayoutGrid}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.eventType && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {tCommon('required')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t('fields.event')}
              <span className="ml-1 text-destructive">*</span>
            </label>
            <Select
              value={eventId != null ? String(eventId) : ''}
              onValueChange={(id) => {
                setValue('eventId', Number(id), { shouldValidate: true });
                setValue('sportId', null);
                setValue('categoryId', null);
              }}
              disabled={!eventType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('fields.selectEvent')}>{selectedEvent ? selectedEvent.name_kh || selectedEvent.name_en : null}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)} icon={CalendarDays}>
                    {e.name_kh || e.name_en || 'Event'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.eventId && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {tCommon('required')}
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">
                {t('fields.organization')}
                <span className="ml-1 text-destructive">*</span>
              </label>
              <Select value={organizationId ?? ''} onValueChange={(id) => setValue('organizationId', id, { shouldValidate: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('fields.selectOrganization')}>{selectedOrg ? selectedOrg.name_kh || selectedOrg.name_en : null}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)} icon={Building2}>
                      {o.name_kh || o.name_en || 'Organization'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.organizationId && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {tCommon('required')}
                </p>
              )}
            </div>
          )}
        </div>

        <hr className="border-border" />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Medal className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('fields.sport')}</span>
            <div className="flex-1 border-t border-border" />
          </div>
          {errors.sportId && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              {tCommon('required')}
            </p>
          )}
          <SelectableGrid
            options={sportOptions}
            value={sportId != null ? String(sportId) : null}
            onChange={(id) => {
              setValue('sportId', id ? Number(id) : null, { shouldValidate: true });
              setValue('categoryId', null);
            }}
            searchPlaceholder={t('fields.selectSport')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
