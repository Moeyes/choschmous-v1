import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import { eventsRepository } from '../adapters';
import type { AddSportToEventPayload, AddOrgToEventSportPayload, DeleteEventSportOrgLinkPayload } from '../types';

export function useAddSportToEvent() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('created') },
        mutationFn: (payload: AddSportToEventPayload) => eventsRepository.addSportToEvent(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.sports(variables.event_id) });
        },
    });
}

export function useRemoveSportFromEvent() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('deleted') },
        mutationFn: ({ associationId }: { eventId: number; associationId: number }) =>
            eventsRepository.removeSportFromEvent(associationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.events.sports(variables.eventId) });
        },
    });
}

export function useAddOrgToEventSport() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    const invalidate = (variables: AddOrgToEventSportPayload) =>
        queryClient.invalidateQueries({
            queryKey: queryKeys.events.sportOrgs(variables.event_id, variables.sport_id),
        });

    return useMutation({
        meta: { successMessage: t('created'), suppressErrorToast: true },
        mutationFn: (payload: AddOrgToEventSportPayload) => eventsRepository.addOrgToEventSport(payload),
        onSuccess: (_, variables) => invalidate(variables),
        onError: (error, variables) => {
            if (axios.isAxiosError(error) && error.response?.status === 500) {
                invalidate(variables);
            }
        },
    });
}

export function useDeleteEventSportOrgLink() {
    const queryClient = useQueryClient();
    const t = useTranslations('common.toast');

    return useMutation({
        meta: { successMessage: t('deleted') },
        mutationFn: (payload: DeleteEventSportOrgLinkPayload) => eventsRepository.deleteEventSportOrgLink(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.sportOrgs(variables.event_id, variables.sport_id),
            });
        },
    });
}
