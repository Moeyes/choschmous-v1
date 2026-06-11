'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { sportsRepository } from '../adapters';
import type { SportCreate, SportUpdate } from '../types';

export function useCreateSport() {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: SportCreate) => sportsRepository.create(dto),
        onSuccess: () => {
            toast.success(tCommon('created'));
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}

export function useUpdateSport() {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: SportUpdate) => sportsRepository.update(dto),
        onSuccess: () => {
            toast.success(tCommon('updated'));
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}

export function useDeleteSport() {
    const qc = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (sportId: number) => sportsRepository.delete(sportId),
        onSuccess: () => {
            toast.success(tCommon('deleted'));
            qc.invalidateQueries({ queryKey: queryKeys.sports.all });
        },
    });
}
