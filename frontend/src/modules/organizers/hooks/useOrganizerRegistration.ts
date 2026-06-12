'use client';

import { useMutation } from '@tanstack/react-query';
import { apiRegisterOrganizer } from '../api';
import type { OrganizerRegistrationPayload } from '../types';

export function useOrganizerRegistration() {
    return useMutation({
        mutationFn: (payload: OrganizerRegistrationPayload) => apiRegisterOrganizer(payload),
    });
}
