import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { eventsRepository } from '../adapters';

export function useEvents() {
    return useQuery({
        queryKey: queryKeys.events.all,
        queryFn: () => eventsRepository.getAll(),
    });
}

export function useEventDetail(eventId: number) {
    return useQuery({
        queryKey: queryKeys.events.detail(eventId),
        queryFn: () => eventsRepository.getById(eventId),
        enabled: !!eventId,
    });
}

export function useEventSports(eventId: number) {
    return useQuery({
        queryKey: queryKeys.events.sports(eventId),
        queryFn: () => eventsRepository.getSports(eventId),
        enabled: !!eventId,
    });
}

export function useEventSportOrgs(eventId: number, sportId: number | null) {
    return useQuery({
        queryKey: queryKeys.events.sportOrgs(eventId, sportId),
        queryFn: () => eventsRepository.getSportOrgs(eventId, sportId!),
        enabled: !!eventId && !!sportId,
    });
}
