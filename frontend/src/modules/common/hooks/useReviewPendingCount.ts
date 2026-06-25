'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { useAuth, UserRole } from '@/core/auth';
import { reviewQueueHttpAdapter } from '../adapters/reviewQueueHttpAdapter';

/**
 * Pending-review count for the "Review queue" nav badge (CHOS-506).
 *
 * Backed by GET /api/v1/dashboard/review-pending-count through a port/adapter +
 * React Query. Only reviewers (ADMIN / SUPER_ADMIN) have a review queue, so the
 * query is disabled for everyone else and the hook returns 0 (badge renders
 * nothing). Returns a plain number to keep the call sites unchanged.
 */
export function useReviewPendingCount(): number {
    const { role } = useAuth();
    const isReviewer = role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

    const { data } = useQuery({
        queryKey: queryKeys.dashboard.reviewPendingCount(role),
        queryFn: () => reviewQueueHttpAdapter.getPendingCount(),
        enabled: isReviewer,
        staleTime: 60_000,
        refetchInterval: 60_000,
    });

    return data?.pending ?? 0;
}
