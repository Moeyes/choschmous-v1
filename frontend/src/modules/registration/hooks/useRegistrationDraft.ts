'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { RegisterFormData, RegisterFormInput } from '../schema/registration.schema';

const DRAFT_PREFIX = 'moeys.registration.draft';
const SAVE_DEBOUNCE_MS = 600;

function draftKey(userId: string | number | null | undefined, mode: string) {
    return `${DRAFT_PREFIX}:${userId ?? 'anon'}:${mode}`;
}

interface UseRegistrationDraftReturn {
    /** Timestamp of the last successful save, or null if nothing saved yet. */
    savedAt: number | null;
    /** Remove the persisted draft (call on successful submit). */
    clearDraft: () => void;
}

/**
 * Autosaves the registration wizard to localStorage so a refresh/return does not
 * lose progress, namespaced per user + wizard mode (the selected event is part
 * of the saved snapshot). Restores once on mount, then debounce-persists on
 * change, and is cleared on successful submit.
 *
 * NOTE (data governance): this writes in-progress registration input — which can
 * include Restricted-PII (names, DOB, phone) — to JS-readable localStorage on
 * the user's own device. It is scoped to the signed-in user and cleared on
 * submit. On shared/kiosk machines this is a residual-data consideration; the
 * draft can be narrowed to non-PII selection fields if policy requires.
 */
export function useRegistrationDraft(
    form: UseFormReturn<RegisterFormInput, unknown, RegisterFormData>,
    userId: string | number | null | undefined,
    mode: string,
    enabled: boolean,
): UseRegistrationDraftReturn {
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const restoredRef = useRef(false);
    const key = draftKey(userId, mode);

    const clearDraft = useCallback(() => {
        try {
            window.localStorage.removeItem(key);
        } catch {
            // Non-fatal (storage unavailable / quota).
        }
        setSavedAt(null);
    }, [key]);

    // Restore once, after the form is ready (enabled gates on cascading data so
    // we don't clobber the wizard's own initialization).
    useEffect(() => {
        if (!enabled || restoredRef.current) return;
        restoredRef.current = true;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) return;
            const saved = JSON.parse(raw) as Partial<RegisterFormInput>;
            form.reset({ ...form.getValues(), ...saved });
            // The "saved" indicator is driven by the debounced watch below; we
            // don't set state synchronously here (avoids cascading renders).
        } catch {
            // Corrupt draft — ignore and start clean.
        }
    }, [enabled, key, form]);

    // Debounced persistence on change.
    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const subscription = form.watch((values) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                try {
                    window.localStorage.setItem(key, JSON.stringify(values));
                    setSavedAt(Date.now());
                } catch {
                    // Non-fatal.
                }
            }, SAVE_DEBOUNCE_MS);
        });
        return () => {
            if (timer) clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, [enabled, key, form]);

    return { savedAt, clearDraft };
}
