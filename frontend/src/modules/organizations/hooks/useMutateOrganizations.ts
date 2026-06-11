'use client';

/**
 * useMutateOrganizations.ts — consolidated mutation hooks (create / update / delete).
 *
 * Toasts:
 *  - Success: explicit generic translated toast (common.toast.*).
 *  - Error:   handled centrally by the global MutationCache in
 *             core/api/queryClient.ts, which shows a generic translated toast
 *             for every failed mutation. We deliberately do NOT add a local
 *             onError toast here — that would double-toast.
 *
 * Cache: invalidate the organizations list and remove the affected detail
 * entry after writes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { organizationsRepository } from '../adapters';
import type { OrganizationCreate, OrganizationUpdateBody } from '../types';

export function useCreateOrganization() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: OrganizationCreate) => organizationsRepository.create(dto),
        onSuccess: () => {
            toast.success(tCommon('created'));
            qc.invalidateQueries({ queryKey: queryKeys.organizations.all });
        },
    });
}

export function useUpdateOrganization() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (dto: OrganizationUpdateBody) => organizationsRepository.update(dto),
        onSuccess: (updated) => {
            toast.success(tCommon('updated'));
            qc.invalidateQueries({ queryKey: queryKeys.organizations.all });
            qc.removeQueries({ queryKey: queryKeys.organizations.detail(updated.id) });
        },
    });
}

export function useDeleteOrganization() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');

    return useMutation({
        mutationFn: (orgId: number) => organizationsRepository.delete(orgId),
        onSuccess: (_data, orgId) => {
            toast.success(tCommon('deleted'));
            qc.removeQueries({ queryKey: queryKeys.organizations.detail(orgId) });
            qc.invalidateQueries({ queryKey: queryKeys.organizations.all });
        },
    });
}
