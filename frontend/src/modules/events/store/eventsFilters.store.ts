import { create } from 'zustand';

type StatusFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';

interface EventsFiltersState {
    search: string;
    status: StatusFilter;
    page:   number;

    setSearch:  (value: string) => void;
    setStatus:  (value: StatusFilter) => void;
    setPage:    (value: number) => void;
    reset:      () => void;
}

const initial = { search: '', status: 'all' as StatusFilter, page: 1 };

export const useEventsFiltersStore = create<EventsFiltersState>((set) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setStatus: (status) => set({ status, page: 1 }),
    setPage:   (page)    => set({ page }),
    reset:     ()        => set(initial),
}));
