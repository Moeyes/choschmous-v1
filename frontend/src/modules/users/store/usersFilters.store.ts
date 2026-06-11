/**
 * usersFilters.store.ts
 *
 * Zustand store for users list UI state: search, role filter, pagination.
 * Holds filter criteria only — never PII records, never auth tokens.
 */
import { create } from 'zustand';
import type { UserListParams } from '../ports/IUsersRepository';

interface UsersFiltersState {
    search:     string;
    roleFilter: string | undefined;
    page:       number;

    setSearch:      (value: string) => void;
    setRoleFilter:  (value: string | undefined) => void;
    setPage:        (value: number) => void;
    reset:          () => void;
    getQueryParams: () => UserListParams;
}

const initial = { search: '', roleFilter: undefined as string | undefined, page: 1 };

export const useUsersFiltersStore = create<UsersFiltersState>((set, get) => ({
    ...initial,
    setSearch:     (search)     => set({ search, page: 1 }),
    setRoleFilter: (roleFilter) => set({ roleFilter, page: 1 }),
    setPage:       (page)       => set({ page }),
    reset:         ()           => set(initial),
    getQueryParams: (): UserListParams => {
        const { search, roleFilter, page } = get();
        const LIMIT = 100;
        return {
            skip:  (page - 1) * LIMIT,
            limit: LIMIT,
            ...(roleFilter ? { role: roleFilter } : {}),
            ...(search     ? { username: search } : {}),
        };
    },
}));
