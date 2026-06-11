import { create } from 'zustand';

interface RegistrationFiltersState {
    search: string;
    page:   number;
    setSearch: (value: string) => void;
    setPage:   (value: number) => void;
    reset:     () => void;
}

const initial = { search: '', page: 1 };

export const useRegistrationFiltersStore = create<RegistrationFiltersState>((set) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setPage:   (page)    => set({ page }),
    reset:     ()        => set(initial),
}));
