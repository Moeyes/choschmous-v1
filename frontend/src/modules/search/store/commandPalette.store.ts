/**
 * commandPalette.store.ts
 *
 * Global open/close state for the ⌘K command palette so any component can open
 * it (e.g. a header button) without prop-drilling.
 */
import { create } from 'zustand';

interface CommandPaletteState {
    open: boolean;
    setOpen: (value: boolean) => void;
    toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    toggle: () => set((s) => ({ open: !s.open })),
}));
