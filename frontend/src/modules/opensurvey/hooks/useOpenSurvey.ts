'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { openSurveyRepository } from '../adapters';

// Events the org can fill an open survey for. Reference-style list → cache a bit.
export function useOpenSurveyEvents() {
  return useQuery({
    queryKey: queryKeys.openSurvey.events,
    queryFn: () => openSurveyRepository.fetchEvents(),
    staleTime: 5 * 60 * 1000,
  });
}

// The org's fill view for a chosen event. Disabled until an event is selected.
// staleTime 0 so the org always sees its freshest saved answers on mount.
export function useOpenSurvey(eventId: number | null, organizationId?: number) {
  return useQuery({
    queryKey: queryKeys.openSurvey.fillView(eventId ?? 0, organizationId),
    queryFn: () => openSurveyRepository.getFillView(eventId as number, organizationId),
    enabled: eventId !== null,
    staleTime: 0,
  });
}

// Admin field-builder list: an event's field definitions (the producer side).
// Field definitions are admin-authored config (labels/types/options), NOT org
// PII — but admins edit them live, so staleTime 0 keeps the list fresh on mount.
export function useOpenSurveyFields(eventId: number | null, includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.openSurvey.fields(eventId ?? 0, includeInactive),
    queryFn: () => openSurveyRepository.listFields(eventId as number, includeInactive),
    enabled: eventId !== null,
    staleTime: 0,
  });
}
