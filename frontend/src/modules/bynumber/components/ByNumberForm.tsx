'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Path } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth, UserRole } from '@/core/auth';
import { useByNumberForm } from '../hooks/useByNumber';
import { bynumberRepository } from '../adapters';
import type { Event, Organization } from '../types';
import { ByNumberFormFields } from './ByNumberFormFields';
import { ByNumberFormNavButtons } from './ByNumberFormNavButtons';
import { ByNumberSuccess } from './ByNumberSuccess';
import { StepIndicator, Badge } from '@/shared';
import { EVENT_TYPES, EVENT_TYPE_ICONS } from '@/core/config/eventTypes';

type Step = 'event_type' | 'event' | 'organization' | 'sports' | 'review';

const ALL_FORM_STEPS: readonly Step[] = ['event_type', 'event', 'organization', 'sports', 'review'];

export function ByNumberForm() {
  const t = useTranslations('bynumber');
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isOrgScoped = user?.role === UserRole.ORGANIZATION && !!user.org_id;

  const FORM_STEPS = useMemo<readonly Step[]>(
    () => (!isAdmin ? ALL_FORM_STEPS.filter((s) => s !== 'organization') : ALL_FORM_STEPS),
    [isAdmin],
  );

  const [currentStep, setCurrentStep] = useState<Step>('event_type');
  const [maxReached, setMaxReached] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportsLoading, setSportsLoading] = useState(false);

  const { form, onSubmit, isPending, serverError } = useByNumberForm(() => {
    setIsSuccess(true);
  });

  const stepIndex = FORM_STEPS.indexOf(currentStep);

  const stepLabels = useMemo(
    () => FORM_STEPS.map((s) => t(`steps.${s}`)),
    [FORM_STEPS, t],
  );

  useEffect(() => {
    if (isOrgScoped && user?.org_id) {
      form.setValue('organizationId', user.org_id);
    }
  }, [isOrgScoped, user?.org_id, form]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (isOrgScoped) {
          setEvents(await bynumberRepository.fetchEvents());
        } else {
          const { events, organizations } = await bynumberRepository.fetchByNumberData();
          setEvents(events);
          setOrganizations(organizations);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOrgScoped]);

  const filteredEvents = selectedEventType
    ? events.filter((e) => {
        const eventTypeFromApi = String(e.type).trim();
        const selectedType = String(selectedEventType).trim();
        if (eventTypeFromApi === selectedType) return true;
        const khValue = EVENT_TYPES.find((et) => et.id === selectedType)?.name_kh;
        if (khValue && eventTypeFromApi === khValue.trim()) return true;
        return false;
      })
    : [];

  const eventId = form.watch('eventId');
  const organizationId = form.watch('organizationId');

  useEffect(() => {
    if (!eventId || !organizationId) return;
    const loadSports = async () => {
      setSportsLoading(true);
      try {
        const sports = await bynumberRepository.fetchOrgEventSports(organizationId, eventId);
        form.setValue('sports', sports);
      } catch {
        // Sports failed to load
      } finally {
        setSportsLoading(false);
      }
    };
    loadSports();
  }, [eventId, organizationId, form]);

  const goToStep = useCallback(
    (idx: number) => {
      setCurrentStep(FORM_STEPS[idx]);
      setMaxReached((m) => Math.max(m, idx));
      scrollTop();
    },
    [FORM_STEPS],
  );

  const handleNext = async () => {
    const currentStepIndex = FORM_STEPS.indexOf(currentStep);
    if (currentStepIndex >= FORM_STEPS.length - 1) return;

    let canProceed = true;

    if (currentStep === 'event_type') {
      if (!selectedEventType) canProceed = false;
    } else {
      const fieldsToValidate: Path<Parameters<typeof onSubmit>[0]>[] = [];
      if (currentStep === 'event') fieldsToValidate.push('eventId');
      else if (currentStep === 'organization') fieldsToValidate.push('organizationId');
      else if (currentStep === 'sports') fieldsToValidate.push('sports');
      canProceed = await form.trigger(fieldsToValidate);
    }

    if (canProceed) goToStep(currentStepIndex + 1);
  };

  const handlePreviousStep = () => {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  };

  const handleStepClick = (idx: number) => {
    if (idx <= maxReached) {
      setCurrentStep(FORM_STEPS[idx]);
      scrollTop();
    }
  };

  const handleRegisterAnother = () => {
    form.reset();
    setIsSuccess(false);
    setCurrentStep('event_type');
    setMaxReached(0);
    setSelectedEventType(null);
  };

  const isReview = currentStep === 'review';

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ByNumberSuccess onRegisterAnother={handleRegisterAnother} />
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

      <StepIndicator steps={stepLabels} currentIndex={stepIndex} onStepClick={handleStepClick} />

      {serverError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{serverError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-20 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-6 animate-spin" />
          {t('loading')}
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {sportsLoading && currentStep === 'sports' ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-20 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="size-6 animate-spin" />
              {t('loadingSports')}
            </div>
          ) : (
            <ByNumberFormFields
              form={form}
              events={filteredEvents}
              organizations={organizations}
              step={currentStep}
              eventTypes={EVENT_TYPES}
              eventTypeIcons={EVENT_TYPE_ICONS}
              selectedEventType={selectedEventType}
              onSelectEventType={setSelectedEventType}
              hideOrganization={!isAdmin}
            />
          )}

          <ByNumberFormNavButtons
            stepIndex={stepIndex}
            isReview={isReview}
            isPending={isPending}
            onPrevious={handlePreviousStep}
            onNext={handleNext}
          />
        </form>
      )}
    </div>
  );
}

function scrollTop() {
  if (typeof window === 'undefined') return;
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
