'use client';

export type RegistrationWindowStatus = 'open' | 'closed' | 'scheduled' | 'unknown';

export interface RegistrationWindow {
    status: RegistrationWindowStatus;
    opensOn?: string;
    closesOn?: string;
}

/**
 * Current registration-window status for the dashboard status line.
 *
 * TODO(registration-window): registration windows are currently per-event
 * (resolved via eventsRepository.getById in the registration flow); there is no
 * system-wide "current window" endpoint. When one exists, wire it here through a
 * port/adapter + React Query. Until then we report 'unknown' so the dashboard
 * shows a neutral state instead of fabricated dates.
 */
export function useRegistrationWindow(): { data: RegistrationWindow; isLoading: boolean } {
    return { data: { status: 'unknown' }, isLoading: false };
}
