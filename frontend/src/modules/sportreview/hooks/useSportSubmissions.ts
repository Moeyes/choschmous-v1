'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { sportSubmissionRepository } from '../adapters';
import type { SportSubmissionsFilter } from '../types';

export function useSportSubmissions(filter: SportSubmissionsFilter) {
    return useQuery({
        queryKey: queryKeys.sportSubmissions.list(filter),
        queryFn: () => sportSubmissionRepository.getAll(filter),
        staleTime: 0,
        gcTime: 0,
    });
}
