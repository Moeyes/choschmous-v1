'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { sportSubmissionRepository } from '../adapters';
import type { SportOrgReviewPayload } from '../types';

/**
 * Bulk-review every pending (SUBMITTED) submission of one organization at once.
 * Mirrors {@link useSportSubmissionReview} but targets the org-level endpoint.
 */
export function useSportOrgReview() {
    const queryClient = useQueryClient();
    const t = useTranslations('sportReview');

    const mutation = useMutation({
        mutationFn: ({ orgId, payload }: { orgId: number; payload: SportOrgReviewPayload }) =>
            sportSubmissionRepository.reviewOrg(orgId, payload),
        onSuccess: (result) => {
            toast.success(t('orgActionSuccess', { count: result.updated }));
            queryClient.invalidateQueries({ queryKey: queryKeys.sportSubmissions.all });
        },
        // Generic, PII-free message only — never surface the raw server detail.
        onError: () => toast.error(t('actionFailed')),
    });

    return {
        reviewOrg: mutation.mutate,
        isReviewing: mutation.isPending,
        error: mutation.error,
        reset: mutation.reset,
    };
}
