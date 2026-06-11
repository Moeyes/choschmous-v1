import { create } from 'zustand';

interface ParticipationFiltersState {
    search: string;
    page:   number;
    setSearch: (value: string) => void;
    setPage:   (value: number) => void;
    reset:     () => void;
}

const initial = { search: '', page: 1 };

export const useParticipationFiltersStore = create<ParticipationFiltersState>((set) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setPage:   (page)    => set({ page }),
    reset:     ()        => set(initial),
}));
