'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth, UserRole } from '@/core/auth';
import { useByCategoryForm } from '../hooks/useByCategory';
import { byCategoryRepository } from '../adapters';
import type { Event } from '../types';
import { ByCategoryFormFields } from './ByCategoryFormFields';
import { ByCategoryFormNavButtons } from './ByCategoryFormNavButtons';
import { ByCategorySuccess } from './ByCategorySuccess';
import { StepIndicator, Badge } from '@/shared';

type Step = 'event' | 'sport' | 'categories' | 'review';

const ALL_FORM_STEPS: readonly Step[] = ['event', 'sport', 'categories', 'review'];

export function ByCategoryForm() {
  const t = useTranslations('bycategory');
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isFederation = user?.role === UserRole.FEDERATION;

  const [currentStep, setCurrentStep] = useState<Step>('event');
  const [maxReached, setMaxReached] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyPending, setCopyPending] = useState(false);
  const [sportName, setSportName] = useState('');
  const [hasPrevious, setHasPrevious] = useState(false);

  const { form, onSubmit, isPending, serverError } = useByCategoryForm(() => {
    setIsSuccess(true);
  });

  const stepIndex = ALL_FORM_STEPS.indexOf(currentStep);

  const stepLabels = useMemo(
    () => ALL_FORM_STEPS.map((s) => t(`steps.${s}.title`)),
    [t],
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const eligibleEvents = await byCategoryRepository.fetchEligibleEvents();
        setEvents(eligibleEvents);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const resolveSportName = useCallback(async (sportId: number) => {
    try {
      setSportName(await byCategoryRepository.fetchSportName(sportId));
    } catch {
      setSportName(`Sport #${sportId}`);
    }
  }, []);

  useEffect(() => {
    if (isFederation && user?.sport_id) {
      form.setValue('sportId', Number(user.sport_id));

      const init = async () => {
        await resolveSportName(Number(user.sport_id));
        try {
          const rows = await byCategoryRepository.fetchPreviousCategories(
            Number(user.sport_id),
            0,
          );
          setHasPrevious(rows.length > 0);
          form.setValue('previousCategories', rows);
        } catch {
          setHasPrevious(false);
        }
      };
      init();
    }
  }, [isFederation, user?.sport_id, form, resolveSportName]);

  const eventId = form.watch('eventId');

  useEffect(() => {
    if (isAdmin && eventId) {
      const sportId = form.watch('sportId');
      if (sportId) {
        const init = async () => {
          await resolveSportName(sportId);
          try {
            const rows = await byCategoryRepository.fetchPreviousCategories(sportId, eventId);
            setHasPrevious(rows.length > 0);
            form.setValue('previousCategories', rows);
          } catch {
            setHasPrevious(false);
          }
        };
        init();
      }
    }
  }, [isAdmin, eventId, form, resolveSportName]);

  const goToStep = useCallback(
    (idx: number) => {
      setCurrentStep(ALL_FORM_STEPS[idx]);
      setMaxReached((m) => Math.max(m, idx));
      scrollTop();
    },
    [],
  );

  const handleCopyFromPrevious = useCallback(async () => {
    setCopyPending(true);
    try {
      const sportId = form.getValues('sportId');
      const currentEventId = form.getValues('eventId');
      if (!sportId) return;
      const rows = await byCategoryRepository.fetchPreviousCategories(
        sportId,
        currentEventId || 0,
      );
      if (rows.length > 0) {
        form.setValue('categories', rows);
      }
    } finally {
      setCopyPending(false);
    }
  }, [form]);

  const handleNext = async () => {
    const currentStepIndex = ALL_FORM_STEPS.indexOf(currentStep);
    if (currentStepIndex >= ALL_FORM_STEPS.length - 1) return;

    let canProceed = true;

    if (currentStep === 'event') {
      canProceed = !!form.watch('eventId');
    } else if (currentStep === 'sport') {
      if (isAdmin && !form.watch('sportId')) {
        canProceed = false;
      }
    } else if (currentStep === 'categories') {
      canProceed = await form.trigger('categories');
    }

    if (canProceed) goToStep(currentStepIndex + 1);
  };

  const handlePreviousStep = () => {
    const idx = ALL_FORM_STEPS.indexOf(currentStep);
    if (idx > 0) goToStep(idx - 1);
  };

  const handleStepClick = (idx: number) => {
    if (idx <= maxReached) {
      setCurrentStep(ALL_FORM_STEPS[idx]);
      scrollTop();
    }
  };

  const handleRegisterAnother = () => {
    form.reset();
    setIsSuccess(false);
    setCurrentStep('event');
    setMaxReached(0);
    setSportName('');
    setHasPrevious(false);
  };

  const isReview = currentStep === 'review';

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ByCategorySuccess onRegisterAnother={handleRegisterAnother} />
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
          <ByCategoryFormFields
            form={form}
            events={events}
            sportName={sportName}
            step={currentStep}
            onCopyFromPrevious={handleCopyFromPrevious}
            hasPrevious={hasPrevious}
            copyPending={copyPending}
          />
          <ByCategoryFormNavButtons
            stepIndex={stepIndex}
            totalSteps={ALL_FORM_STEPS.length}
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
