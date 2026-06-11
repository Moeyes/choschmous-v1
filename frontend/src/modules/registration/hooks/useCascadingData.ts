import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { loadCascadingData } from '@/core/api/referenceData';

export function useCascadingData() {
    return useQuery({
        queryKey: queryKeys.referenceData.cascading,
        queryFn: loadCascadingData,
        staleTime: 300_000,
        gcTime: 600_000,
    });
}
