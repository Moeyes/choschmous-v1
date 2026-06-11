/**
 * useRegisterMutation Hook
 * 
 * React Query mutation for user registration
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { registrationRepository } from '@/modules/registration/adapters';
import { RegisterPayload, RegisterResponse } from '@/modules/registration/types';

interface UseRegisterMutationOptions {
    onSuccess?: (data: RegisterResponse) => void;
    onError?: (error: unknown) => void;
}

/**
 * Hook for registration mutation
 */
export function useRegisterMutation(options?: UseRegisterMutationOptions) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: RegisterPayload) => registrationRepository.register(payload),
        onSuccess: (data: RegisterResponse) => {
            // A new enrollment changes the registrations list (and, via the
            // global MutationCache, the dashboard KPIs / recent enrollments).
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all });

            // Call custom success handler if provided
            if (options?.onSuccess) {
                options.onSuccess(data);
            }
        },
        onError: (error) => {
            // Call custom error handler if provided
            if (options?.onError) {
                options.onError(error);
            }
        },
    });
}
