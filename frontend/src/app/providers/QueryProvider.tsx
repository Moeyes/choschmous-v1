/**
 * Query Provider
 *
 * React Query client provider for server/client component boundary. The client
 * itself is the shared singleton from `core/api/queryClient` (so non-component
 * code such as `core/auth` logout can reach it); this provider only mounts it
 * and keeps the toast fallback locale-synced.
 */

'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { toastFallback } from '@/shared/utils/apiError';
import { queryClient } from '@/core/api/queryClient';

/**
 * Keeps the module-level toast fallback in sync with the active locale, since
 * MutationCache callbacks run outside the React tree and cannot use hooks.
 */
function ToastI18nBridge() {
    const t = useTranslations('common.toast');
    useEffect(() => {
        toastFallback.error = t('error');
    }, [t]);
    return null;
}

interface QueryProviderProps {
    children: ReactNode;
}

/**
 * Wraps children with React Query client provider
 */
export function QueryProvider({ children }: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <ToastI18nBridge />
            {children}
        </QueryClientProvider>
    );
}
