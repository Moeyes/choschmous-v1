'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { sportSubmissionRepository } from '../adapters';
import type { SportReviewPayload } from '../types';

export function useSportSubmissionReview() {
    const queryClient = useQueryClient();
    const t = useTranslations('sportReview');

    const mutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: SportReviewPayload }) =>
            sportSubmissionRepository.review(id, payload),
        onSuccess: () => {
            toast.success(t('actionSuccess'));
            queryClient.invalidateQueries({ queryKey: queryKeys.sportSubmissions.all });
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
