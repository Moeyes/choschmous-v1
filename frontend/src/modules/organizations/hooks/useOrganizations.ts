'use client';

/**
 * useOrganizations.ts — consolidated read hooks.
 *
 * Organization data is non-PII (Internal/Confidential), so normal caching
 * (the QueryClient defaults) applies — no staleTime/gcTime overrides.
 *
 * useOrganizations() defaults to { skip: 0, limit: 100 }, matching the
 * pre-refactor request and giving every no-arg consumer one shared cache key.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { organizationsRepository } from '../adapters';
import type { OrganizationListParams } from '../ports/IOrganizationsRepository';

const DEFAULT_LIST_PARAMS: OrganizationListParams = { skip: 0, limit: 100 };

export function useOrganizations(params: OrganizationListParams = DEFAULT_LIST_PARAMS) {
    return useQuery({
        queryKey: queryKeys.organizations.list(params),
        queryFn:  () => organizationsRepository.getAll(params),
        select:   (res) => res.data,
    });
}
