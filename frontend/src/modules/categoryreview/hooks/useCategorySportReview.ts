'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { categorySubmissionRepository } from '../adapters';
import type { CategorySportReviewPayload } from '../types';

/**
 * Bulk-review every pending (SUBMITTED) by-category submission for one sport at
 * once. Mirrors {@link useCategorySubmissionReview} but targets the sport-level
 * endpoint.
 */
export function useCategorySportReview() {
    const queryClient = useQueryClient();
    const t = useTranslations('categoryReview');

    const mutation = useMutation({
        mutationFn: ({ sportId, payload }: { sportId: number; payload: CategorySportReviewPayload }) =>
            categorySubmissionRepository.reviewSport(sportId, payload),
        onSuccess: (result) => {
            toast.success(t('sportActionSuccess', { count: result.updated }));
            queryClient.invalidateQueries({ queryKey: queryKeys.categorySubmissions.all });
        },
        onError: () => toast.error(t('actionFailed')),
    });

    return {
        reviewSport: mutation.mutate,
        isReviewing: mutation.isPending,
        error: mutation.error,
        reset: mutation.reset,
    };
}
