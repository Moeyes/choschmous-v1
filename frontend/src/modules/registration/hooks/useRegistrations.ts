'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { registrationRepository } from '../adapters';

interface RegistrationsFilter {
    organization_id?: number;
    event_id?: number;
    sport_id?: number;
    search?: string;
    skip?: number;
    limit?: number;
}

export function useRegistrations(filter: RegistrationsFilter) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.registrations.list(filter),
        queryFn: () => registrationRepository.getAll(filter as Record<string, unknown>),
        staleTime: 0,
        gcTime:    0,
    });

    const deleteMutation = useMutation({
        mutationFn: (enrollId: number) => registrationRepository.delete(enrollId),
        onMutate: async (enrollId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.registrations.all });
            const previousData = queryClient.getQueriesData({ queryKey: queryKeys.registrations.all });
            queryClient.setQueriesData({ queryKey: queryKeys.registrations.all }, (old: unknown) => {
                if (!old || typeof old !== 'object') return old;
                const oldData = old as Record<string, unknown>;
                if ('data' in oldData && Array.isArray(oldData.data)) {
                    return {
                        ...oldData,
                        data: oldData.data.filter(
                            (item: Record<string, unknown>) => item.enroll_id !== enrollId,
                        ),
                    };
                }
                return old;
            });
            return { previousData };
        },
        onError: (_err, _enrollId, context) => {
            if (context?.previousData) {
                for (const [key, data] of context.previousData) {
                    queryClient.setQueryData(key, data);
                }
            }
        },
        onSettled: () => {
            // Reconcile the optimistic removal with the server. Dashboard
            // invalidation is handled centrally by the global MutationCache.
            queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all });
        },
    });

    return {
        ...query,
        deleteRegistration: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
    };
}
