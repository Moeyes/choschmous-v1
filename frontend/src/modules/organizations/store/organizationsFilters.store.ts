/**
 * organizationsFilters.store.ts
 *
 * Zustand store for the organizations list UI state: search, sort, pagination.
 * Holds filter criteria only. With the initial state, getQueryParams() returns
 * { skip: 0, limit: 100 } — identical to the pre-refactor list request.
 */
import { create } from 'zustand';
import type { OrganizationListParams } from '../ports/IOrganizationsRepository';

interface OrganizationsFiltersState {
    search: string;
    sort:   string | undefined;
    page:   number;

    setSearch:      (value: string) => void;
    setSort:        (value: string | undefined) => void;
    setPage:        (value: number) => void;
    reset:          () => void;
    getQueryParams: () => OrganizationListParams;
}

const initial = { search: '', sort: undefined as string | undefined, page: 1 };

export const useOrganizationsFiltersStore = create<OrganizationsFiltersState>((set, get) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setSort:   (sort)   => set({ sort, page: 1 }),
    setPage:   (page)   => set({ page }),
    reset:     ()       => set(initial),
    getQueryParams: (): OrganizationListParams => {
        const { search, page } = get();
        const LIMIT = 100;
        return {
            skip:  (page - 1) * LIMIT,
            limit: LIMIT,
            ...(search ? { name: search } : {}),
        };
    },
}));
