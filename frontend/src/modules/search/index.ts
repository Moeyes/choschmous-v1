/**
 * search module (CHOS-304) — global ⌘K command palette.
 *
 * Public surface: the CommandPalette component (mounted in the portal shell),
 * the open/close store (so any trigger can open it), and the read hook.
 */
export { CommandPalette } from './components';
export { useSearch } from './hooks';
export { useCommandPaletteStore } from './store/commandPalette.store';
export type { SearchHit, SearchResponse, SearchType } from './schema/search.schema';
