'use client';

/**
 * useMutateUsers.ts — consolidated mutation hooks (create / update / delete).
 *
 * All three are auditable actions. The server performs the authoritative audit
 * log write and enforces SUPER_ADMIN on every endpoint. The frontend ensures:
 *   1. Requests are authenticated (apiClient sends httpOnly cookies).
 *   2. Errors shown to the user are generic — no raw backend detail in toasts.
 *   3. Cache is invalidated + PII detail entries removed after each mutation
 *      (right-to-erasure: no hidden client copies survive a delete).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/core/api/queryKeys';
import { usersRepository } from '../adapters';
import type { UserCreate, UserUpdate } from '../types';

export function useCreateUser() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');
    const t       = useTranslations('users');

    return useMutation({
        mutationFn: (dto: UserCreate) => usersRepository.create(dto),
        onSuccess: () => {
            toast.success(tCommon('created'));
            qc.invalidateQueries({ queryKey: queryKeys.users.all });
        },
        onError: () => toast.error(t('failedToLoad')),
    });
}

export function useUpdateUser() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');
    const t       = useTranslations('users');

    return useMutation({
        mutationFn: (dto: UserUpdate) => usersRepository.update(dto),
        onSuccess: (updated) => {
            toast.success(tCommon('updated'));
            qc.invalidateQueries({ queryKey: queryKeys.users.all });
            qc.removeQueries({ queryKey: queryKeys.users.detail(updated.id) });
        },
        onError: () => toast.error(t('failedToLoad')),
    });
}

export function useDeleteUser() {
    const qc      = useQueryClient();
    const tCommon = useTranslations('common.toast');
    const t       = useTranslations('users');

    return useMutation({
        mutationFn: (userId: string) => usersRepository.delete(userId),
        onSuccess: (_data, userId) => {
            toast.success(tCommon('deleted'));
            qc.removeQueries({ queryKey: queryKeys.users.detail(userId) });
            qc.invalidateQueries({ queryKey: queryKeys.users.all });
        },
        onError: () => toast.error(t('failedToLoad')),
    });
}
