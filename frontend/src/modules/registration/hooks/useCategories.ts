import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/core/api/referenceData';

export function useCategories(eventId: number | undefined, sportId: number | undefined) {
    return useQuery({
        queryKey: ['categories', eventId, sportId],
        queryFn: () => fetchCategories(eventId!, sportId!),
        enabled: !!eventId && !!sportId,
        staleTime: 300_000,
        gcTime: 600_000,
    });
}
