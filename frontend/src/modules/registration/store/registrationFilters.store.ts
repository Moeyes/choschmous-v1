import { create } from 'zustand';

interface RegistrationFiltersState {
    search: string;
    page:   number;
    categoryId: string;
    gender: string;
    setSearch: (value: string) => void;
    setPage:   (value: number) => void;
    setCategoryId: (value: string) => void;
    setGender: (value: string) => void;
    reset:     () => void;
}

const initial = { search: '', page: 1, categoryId: '', gender: '' };

export const useRegistrationFiltersStore = create<RegistrationFiltersState>((set) => ({
    ...initial,
    setSearch: (search) => set({ search, page: 1 }),
    setPage:   (page)    => set({ page }),
    setCategoryId: (categoryId) => set({ categoryId, page: 1 }),
    setGender: (gender) => set({ gender, page: 1 }),
    reset:     ()        => set(initial),
}));
