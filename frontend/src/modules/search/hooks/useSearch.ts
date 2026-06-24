'use client';

/**
 * useSearch.ts — read hook for the ⌘K palette.
 *
 * Results may include athlete names (Restricted-PII display only), so the cache
 * is short-lived (staleTime 30s) and only fires for queries of >= 2 chars.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { searchRepository } from '../adapters';

const MIN_QUERY_LENGTH = 2;

export function useSearch(query: string, enabled = true) {
    const trimmed = query.trim();
    return useQuery({
        queryKey: queryKeys.search.query(trimmed),
        queryFn: () => searchRepository.search({ query: trimmed }),
        enabled: enabled && trimmed.length >= MIN_QUERY_LENGTH,
        select: (res) => res.data,
        staleTime: 30_000,
    });
}
