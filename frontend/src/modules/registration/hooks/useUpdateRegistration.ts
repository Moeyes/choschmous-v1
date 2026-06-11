'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { registrationRepository } from '../adapters';
import type { ParticipantUpdateData } from '../types';

interface UpdateArgs {
    enrollId: number;
    role: string;
    data: ParticipantUpdateData;
}

/**
 * Update a participant from the detail view. On success it refreshes the
 * detail record and the registrations list so both reflect the edit.
 */
export function useUpdateRegistration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ enrollId, role, data }: UpdateArgs) =>
            registrationRepository.update(enrollId, role, data),
        onSuccess: (_result, { enrollId, role }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.detail(enrollId, role) });
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all });
        },
    });
}
