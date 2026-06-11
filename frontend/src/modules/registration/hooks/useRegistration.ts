'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { registrationRepository } from '../adapters';

/**
 * Fetch a single participant's full record for the detail view.
 *
 * `role` ('athlete' | 'leader') is required: the backend reads athletes and
 * leaders from different tables and uses it to pick the right one. The query is
 * disabled until both id and role are known. Not cached aggressively — the
 * detail view carries Restricted-PII, so we keep it short-lived.
 */
export function useRegistration(enrollId?: number, role?: string) {
    return useQuery({
        queryKey: queryKeys.registrations.detail(enrollId ?? 0, role ?? ''),
        queryFn: () => registrationRepository.getById(enrollId as number, role as string),
        enabled: Boolean(enrollId) && Boolean(role),
        staleTime: 0,
        gcTime: 0,
    });
}
