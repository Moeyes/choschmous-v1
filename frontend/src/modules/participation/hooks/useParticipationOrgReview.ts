'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { participationRepository } from '../adapters';
import type { ParticipationOrgReviewPayload } from '../types';

/**
 * Bulk-review every pending (SUBMITTED) submission of one organization at once.
 * Admin-only; mirrors the by-sport queue's org-level review.
 */
export function useParticipationOrgReview() {
    const queryClient = useQueryClient();
    const t = useTranslations('participation');

    const mutation = useMutation({
        mutationFn: ({ orgId, payload }: { orgId: number; payload: ParticipationOrgReviewPayload }) =>
            participationRepository.reviewOrg(orgId, payload),
        onSuccess: (result) => {
            toast.success(t('orgActionSuccess', { count: result.updated }));
            queryClient.invalidateQueries({ queryKey: queryKeys.participations.all });
        },
        onError: () => toast.error(t('orgActionFailed')),
    });

    return {
        reviewOrg: mutation.mutate,
        isReviewing: mutation.isPending,
        error: mutation.error,
        reset: mutation.reset,
    };
}
