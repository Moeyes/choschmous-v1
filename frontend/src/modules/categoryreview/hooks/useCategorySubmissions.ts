'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { categorySubmissionRepository } from '../adapters';
import type { CategorySubmissionsFilter } from '../types';

export function useCategorySubmissions(filter: CategorySubmissionsFilter) {
    return useQuery({
        queryKey: queryKeys.categorySubmissions.list(filter),
        queryFn: () => categorySubmissionRepository.getAll(filter),
        staleTime: 0,
        gcTime: 0,
    });
}

export function useCategorySubmission(id: number) {
    return useQuery({
        queryKey: queryKeys.categorySubmissions.detail(id),
        queryFn: () => categorySubmissionRepository.getById(id),
        staleTime: 0,
        gcTime: 0,
    });
}
