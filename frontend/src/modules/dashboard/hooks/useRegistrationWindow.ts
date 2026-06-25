'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { dashboardHttpAdapter } from '../adapters/dashboardHttpAdapter';
import type {
    RegistrationWindow,
    RegistrationWindowStatus,
} from '../schema/registrationWindow.schema';

export type { RegistrationWindow, RegistrationWindowStatus };

const NEUTRAL: RegistrationWindow = { status: 'unknown' };

/**
 * System-wide registration-window status for the dashboard status line
 * (registration-window). Backed by GET /api/v1/dashboard/registration-window
 * through the dashboard port/adapter + React Query.
 *
 * Public scheduling data (no PII). While loading or on error we report the
 * neutral 'unknown' state instead of fabricated dates. Returns the same
 * `{ data, isLoading }` shape the status line already consumes.
 */
export function useRegistrationWindow(): {
    data: RegistrationWindow;
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: queryKeys.dashboard.registrationWindow,
        queryFn: () => dashboardHttpAdapter.getRegistrationWindow(),
        staleTime: 5 * 60_000,
    });

    return { data: data ?? NEUTRAL, isLoading };
}
