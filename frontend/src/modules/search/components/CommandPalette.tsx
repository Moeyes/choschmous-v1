'use client';

/**
 * CommandPalette — global ⌘K / Ctrl+K search (CHOS-304).
 *
 * Mounted once inside the authenticated shell (PortalShell). Opens on ⌘K/Ctrl+K,
 * searches events / organizations / athletes via the search module, and
 * navigates to the selected record. Keyboard-first: ↑/↓ to move, Enter to open,
 * Esc to close.
 *
 * PII: results are minimized (name + org only) and never logged. The query is
 * POSTed by the adapter, so it never enters a URL or history entry.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { routes } from '@/core/config/routes';
import { useSearch } from '../hooks';
import { useCommandPaletteStore } from '../store/commandPalette.store';
import { SEARCH_TYPES, type SearchHit, type SearchType } from '../schema/search.schema';

const DEBOUNCE_MS = 200;

function hrefForHit(hit: SearchHit): string {
    switch (hit.type) {
        case 'event':
            return routes.eventDetail(hit.id);
        case 'organization':
            return `${routes.organizations}/${hit.id}`;
        case 'athlete':
            return routes.registrationDetail(hit.id);
        default:
            return routes.dashboard;
    }
}

export function CommandPalette() {
    const t = useTranslations('search');
    const router = useRouter();
    const { open, setOpen, toggle } = useCommandPaletteStore();

    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Global ⌘K / Ctrl+K to toggle; Esc handled on the panel when open.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggle]);

    // Debounce the query feeding the request.
    useEffect(() => {
        const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [query]);

    // Reset transient state whenever the palette opens/closes.
    useEffect(() => {
        if (open) {
            setActiveIndex(0);
            // Focus after paint.
            const id = setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }
        setQuery('');
        setDebounced('');
    }, [open]);

    const { data: hits = [], isFetching } = useSearch(debounced, open);

    // Stable group order for both rendering and keyboard navigation.
    const grouped = useMemo(() => {
        return SEARCH_TYPES.map((type) => ({
            type,
            items: hits.filter((h) => h.type === type),
        })).filter((g) => g.items.length > 0);
    }, [hits]);

    const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

    useEffect(() => {
        // Keep the highlighted row within bounds as results change.
        setActiveIndex((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
    }, [flat.length]);

    const close = useCallback(() => setOpen(false), [setOpen]);

    const go = useCallback(
        (hit: SearchHit) => {
            close();
            router.push(hrefForHit(hit));
        },
        [close, router],
    );

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const hit = flat[activeIndex];
            if (hit) go(hit);
        }
    };

    if (!open) return null;

    const showMinChars = debounced.trim().length > 0 && debounced.trim().length < 2;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
            role="presentation"
            onClick={close}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t('title')}
                className="w-full max-w-xl overflow-hidden rounded-lg border bg-background shadow-xl"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={onKeyDown}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('placeholder')}
                    aria-label={t('placeholder')}
                    className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                />

                <div className="max-h-80 overflow-y-auto py-2">
                    {showMinChars && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t('minChars')}
                        </p>
                    )}

                    {!showMinChars && isFetching && flat.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t('searching')}
                        </p>
                    )}

                    {!showMinChars && !isFetching && debounced.trim().length >= 2 && flat.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {t('empty')}
                        </p>
                    )}

                    {grouped.map((group) => (
                        <div key={group.type} className="px-2 py-1">
                            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t(`groups.${group.type}` as `groups.${SearchType}`)}
                            </p>
                            <ul>
                                {group.items.map((hit) => {
                                    const index = flat.indexOf(hit);
                                    const active = index === activeIndex;
                                    return (
                                        <li key={`${hit.type}-${hit.id}`}>
                                            <button
                                                type="button"
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => go(hit)}
                                                className={`flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm ${
                                                    active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                                                }`}
                                            >
                                                <span className="truncate font-medium">{hit.title}</span>
                                                {hit.subtitle && (
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {hit.subtitle}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
                    <span>{t('hint')}</span>
                    <kbd className="rounded border px-1.5 py-0.5">Esc</kbd>
                </div>
            </div>
        </div>
    );
}
