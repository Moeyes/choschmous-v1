'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { sportsRepository } from '../adapters';
import type { AddCategoryBody, UpdateCategoryBody, DeleteCategoryBody } from '../types';

export function useAddCategory() {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: AddCategoryBody) => sportsRepository.addCategory(dto),
        onSuccess: (_, variables) => {
            toast.success(tCommon('created'));
            qc.invalidateQueries({ queryKey: queryKeys.categories.bySport(variables.sport_id) });
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}

export function useUpdateCategory() {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: UpdateCategoryBody) => sportsRepository.updateCategory(dto),
        onSuccess: (_, variables) => {
            toast.success(tCommon('updated'));
            if (variables.sport_id) {
                qc.invalidateQueries({ queryKey: queryKeys.categories.bySport(variables.sport_id) });
            }
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}

export function useDeleteCategory(sportId: number) {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (payload: DeleteCategoryBody) => sportsRepository.deleteCategory(payload),
        onSuccess: () => {
            toast.success(tCommon('deleted'));
            qc.invalidateQueries({ queryKey: queryKeys.categories.bySport(sportId) });
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}
