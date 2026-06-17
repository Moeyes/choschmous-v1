'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { categorySubmissionRepository } from '../adapters';
import type { CategoryReviewPayload } from '../types';

export function useCategorySubmissionReview() {
    const queryClient = useQueryClient();
    const t = useTranslations('categoryReview');

    const mutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CategoryReviewPayload }) =>
            categorySubmissionRepository.review(id, payload),
        onSuccess: () => {
            toast.success(t('actionSuccess'));
            // Covers both the list and the per-id detail (shared key prefix).
            queryClient.invalidateQueries({ queryKey: queryKeys.categorySubmissions.all });
        },
        // Generic, PII-free message only — never surface the raw server detail.
        onError: () => toast.error(t('actionFailed')),
    });

    return {
        review: mutation.mutate,
        isReviewing: mutation.isPending,
        error: mutation.error,
        reset: mutation.reset,
    };
}
