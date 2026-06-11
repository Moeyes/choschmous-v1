'use client';

/**
 * useUsers.ts — consolidated read hooks.
 *
 * staleTime: 0 + gcTime: 0 on all queries because user records contain
 * Restricted-PII (names, email). Data must never be retained in cache
 * after the component unmounts.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { usersRepository } from '../adapters';
import type { UserListParams } from '../ports/IUsersRepository';

export function useUsers(params?: UserListParams) {
    return useQuery({
        queryKey: queryKeys.users.list(params),
        queryFn:  () => usersRepository.getAll(params),
        staleTime: 0,
        gcTime:    0,
        select:    (res) => res.data,
    });
}
