'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryKeys';
import { participationRepository } from '../adapters';
import { ParticipationPerSportPayload } from '../types';

export function useParticipationMutation() {
    const queryClient = useQueryClient();

    // Dashboard invalidation is handled centrally by the global MutationCache
    // (core/api/queryClient.ts), so these hooks only invalidate their own domain.
    const create = useMutation({
        mutationFn: (payload: ParticipationPerSportPayload) => participationRepository.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.participations.all });
        },
    });

    const update = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<ParticipationPerSportPayload> }) =>
            participationRepository.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.participations.all });
        },
    });

    const remove = useMutation({
        mutationFn: (id: number) => participationRepository.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.participations.all });
        },
    });

    return {
        create: create.mutate,
        isCreating: create.isPending,
        update: update.mutate,
        isUpdating: update.isPending,
        remove: remove.mutate,
        isRemoving: remove.isPending,
    };
}
