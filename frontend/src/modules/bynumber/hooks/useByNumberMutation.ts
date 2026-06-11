import { useMutation } from '@tanstack/react-query';
import { bynumberRepository } from '../adapters';
import type { SportRow } from '../types';

export function useByNumberMutation() {
    return useMutation({
        mutationFn: ({
            organizationId,
            eventId,
            sports,
        }: {
            organizationId: number;
            eventId: number;
            sports: SportRow[];
        }) => bynumberRepository.submitByNumber({ organization_id: organizationId, event_id: eventId, sports: sports.map(s => ({
            sport_id: s.sport_id,
            athlete_male_count: s.athlete_male_count || 0,
            athlete_female_count: s.athlete_female_count || 0,
            leader_male_count: s.leader_male_count || 0,
            leader_female_count: s.leader_female_count || 0,
        })) }),
    });
}
