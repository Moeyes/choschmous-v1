'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/core/auth';
import { Badge } from '@/shared';
import { useOpenSurveyEvents, useOpenSurvey } from '../hooks';
import { OpenSurveyEventStep } from './OpenSurveyEventStep';
import { OpenSurveyForm } from './OpenSurveyForm';
import { OpenSurveySuccess } from './OpenSurveySuccess';

export function OpenSurveyPage() {
  const t = useTranslations('opensurvey');
  const { user } = useAuth();
  // ORG users are forced to their own org server-side; admins may target an org
  // they're bound to. No org binding → the server returns an empty fill view.
  const organizationId = user?.organization_id ?? user?.org_id ?? undefined;

  const [eventId, setEventId] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: events = [], isLoading: eventsLoading } = useOpenSurveyEvents();
  const { data: fields = [], isLoading: fieldsLoading } = useOpenSurvey(eventId, organizationId);

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <OpenSurveySuccess onFillAnother={() => setIsSuccess(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="text-center">
        <Badge variant="primary" size="sm" className="mb-4 inline-flex gap-1.5">
          <Sparkles className="size-3.5" />
          {t('title')}
        </Badge>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {eventsLoading ? (
        <LoadingCard label={t('loading')} />
      ) : (
        <OpenSurveyEventStep events={events} value={eventId} onChange={setEventId} />
      )}

      {eventId !== null &&
        (fieldsLoading ? (
          <LoadingCard label={t('loadingFields')} />
        ) : (
          <OpenSurveyForm
            eventId={eventId}
            organizationId={organizationId}
            fields={fields}
            onSuccess={() => setIsSuccess(true)}
          />
        ))}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-20 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="size-6 animate-spin" />
      {label}
    </div>
  );
}
