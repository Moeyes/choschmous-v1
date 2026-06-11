'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { participationRepository } from '../adapters';

interface ParticipationsFilter {
    organization_id?: number;
    event_id?: number;
    sport_id?: number;
    skip?: number;
    limit?: number;
}

export function useParticipations(filter: ParticipationsFilter) {
    return useQuery({
        queryKey: queryKeys.participations.list(filter),
        queryFn: () => participationRepository.getAll(filter),
        staleTime: 0,
        gcTime:    0,
    });
}
