import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { useTranslations } from 'next-intl';
import { eventsRepository } from '../adapters';
import type { EventCreate, EventUpdate, PhaseUpdatePayload } from '../types';

export function useCreateEvent() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('created') },
        mutationFn: (eventData: EventCreate) => eventsRepository.create(eventData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
        },
    });
}

export function useUpdateEvent() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('updated') },
        mutationFn: (eventData: EventUpdate) => eventsRepository.update(eventData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
        },
    });
}

export function useDeleteEvent() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('deleted') },
        mutationFn: (eventId: number) => eventsRepository.delete(eventId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
        },
    });
}

export function useUpdateEventPhase() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('updated') },
        mutationFn: (payload: PhaseUpdatePayload) => eventsRepository.updatePhase(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.all });
        },
    });
}
