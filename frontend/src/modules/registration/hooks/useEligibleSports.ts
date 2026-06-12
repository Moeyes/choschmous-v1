import { useQuery } from '@tanstack/react-query';
import { fetchEligibleSports, type EligibleSport } from '@/core/api/referenceData';

/** Sports the caller's org may register for in an event, with per-sport config
 * and the org's current athlete count (for the quota meter). */
export function useEligibleSports(eventId: number | undefined) {
    return useQuery<EligibleSport[]>({
        queryKey: ['eligible-sports', eventId],
        queryFn: () => fetchEligibleSports(eventId!),
        enabled: !!eventId,
        staleTime: 60_000,
        gcTime: 300_000,
    });
}
