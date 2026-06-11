import { create } from 'zustand';
import type { SportListParams } from '../ports/ISportsRepository';

interface SportsFiltersState {
    search: string;
    page:   number;

    setSearch:    (value: string) => void;
    setPage:      (value: number) => void;
    reset:        () => void;
    getQueryParams: () => SportListParams;
}

const initial = { search: '', page: 1 };

export const useSportsFiltersStore = create<SportsFiltersState>((set, get) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setPage:   (page)   => set({ page }),
    reset:     ()       => set(initial),
    getQueryParams: (): SportListParams => {
        const { page } = get();
        const LIMIT = 200;
        return {
            skip:  (page - 1) * LIMIT,
            limit: LIMIT,
        };
    },
}));
